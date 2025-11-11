-- Step 2: Create index for rejected orders and update analytics trigger
CREATE INDEX IF NOT EXISTS idx_orders_rejected 
ON public.orders(venue_id, status) 
WHERE status = 'rejected';

-- Update order analytics trigger to track rejections
CREATE OR REPLACE FUNCTION public.track_order_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items_count INTEGER;
  v_quoted_time INTEGER;
  v_actual_time INTEGER;
BEGIN
  -- Count items
  v_items_count := jsonb_array_length(COALESCE(NEW.items, '[]'::jsonb));
  
  -- When order is first placed, create analytics record
  IF TG_OP = 'INSERT' THEN
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
  
  -- When order status changes, update analytics
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
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
    
    -- Mark when order is rejected (for analytics tracking)
    IF NEW.status = 'rejected' THEN
      UPDATE public.order_analytics
      SET 
        delay_reason = 'Order rejected by kitchen - invalid order number'
      WHERE order_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;