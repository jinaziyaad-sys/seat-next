-- Add 'cancelled' status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add cancellation_type column to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Add merchant_acknowledged column to waitlist_entries
ALTER TABLE public.waitlist_entries 
ADD COLUMN IF NOT EXISTS merchant_acknowledged BOOLEAN DEFAULT false;

-- Add rejected_orders_count to daily_venue_snapshots
ALTER TABLE public.daily_venue_snapshots 
ADD COLUMN IF NOT EXISTS rejected_orders_count INTEGER DEFAULT 0;

-- Update track_order_analytics trigger to preserve analytics for cancelled orders
CREATE OR REPLACE FUNCTION public.track_order_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_items_count INTEGER;
  v_quoted_time INTEGER;
  v_actual_time INTEGER;
BEGIN
  -- Count items
  v_items_count := jsonb_array_length(COALESCE(NEW.items, '[]'::jsonb));
  
  -- When order is first placed, create analytics record (skip if rejected)
  IF TG_OP = 'INSERT' AND NEW.status != 'rejected' THEN
    -- Calculate quoted time (extract from ETA if available)
    IF NEW.eta IS NOT NULL THEN
      v_quoted_time := EXTRACT(EPOCH FROM (NEW.eta - NEW.created_at))::INTEGER / 60;
    ELSE
      v_quoted_time := 15; -- default
    END IF;
    
    INSERT INTO public.order_analytics (
      venue_id,
      order_id,
      placed_at,
      quoted_prep_time,
      day_of_week,
      hour_of_day,
      items_count
    ) VALUES (
      NEW.venue_id,
      NEW.id,
      NEW.created_at,
      v_quoted_time,
      EXTRACT(DOW FROM NEW.created_at)::INTEGER,
      EXTRACT(HOUR FROM NEW.created_at)::INTEGER,
      v_items_count
    );
  END IF;
  
  -- When order status changes, update analytics (skip if rejected)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'rejected' THEN
    -- Mark when prep started
    IF NEW.status = 'in_prep' THEN
      UPDATE public.order_analytics
      SET in_prep_at = now()
      WHERE order_id = NEW.id;
    END IF;
    
    -- Mark when order is ready and calculate actual time
    IF NEW.status = 'ready' THEN
      UPDATE public.order_analytics
      SET 
        ready_at = now(),
        actual_prep_time = EXTRACT(EPOCH FROM (now() - placed_at))::INTEGER / 60
      WHERE order_id = NEW.id;
    END IF;
    
    -- Mark when order is collected
    IF NEW.status = 'collected' THEN
      UPDATE public.order_analytics
      SET collected_at = now()
      WHERE order_id = NEW.id;
    END IF;
    
    -- Mark when order is cancelled (preserve analytics, just note it)
    IF NEW.status = 'cancelled' THEN
      UPDATE public.order_analytics
      SET collected_at = now() -- Mark as completed for analytics purposes
      WHERE order_id = NEW.id;
    END IF;
  END IF;
  
  -- If order is rejected (invalid order number), delete its analytics record if it exists
  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' THEN
    DELETE FROM public.order_analytics WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;