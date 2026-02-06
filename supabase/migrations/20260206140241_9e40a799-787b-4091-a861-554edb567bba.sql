-- Update track_order_analytics to use venue timezone
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
  v_venue_timezone TEXT;
  v_local_timestamp TIMESTAMP;
BEGIN
  -- Get venue timezone
  SELECT COALESCE(timezone, 'Africa/Johannesburg') INTO v_venue_timezone
  FROM venues WHERE id = NEW.venue_id;
  
  -- Convert to venue local time for analytics
  v_local_timestamp := (NEW.created_at AT TIME ZONE 'UTC') AT TIME ZONE v_venue_timezone;
  
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
      EXTRACT(DOW FROM v_local_timestamp)::INTEGER,
      EXTRACT(HOUR FROM v_local_timestamp)::INTEGER,
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

-- Update track_waitlist_analytics to use venue timezone
CREATE OR REPLACE FUNCTION public.track_waitlist_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quoted_time INTEGER;
  v_actual_time INTEGER;
  v_venue_timezone TEXT;
  v_local_timestamp TIMESTAMP;
BEGIN
  -- Get venue timezone
  SELECT COALESCE(timezone, 'Africa/Johannesburg') INTO v_venue_timezone
  FROM venues WHERE id = NEW.venue_id;
  
  -- Convert to venue local time for analytics
  v_local_timestamp := (NEW.created_at AT TIME ZONE 'UTC') AT TIME ZONE v_venue_timezone;
  
  -- When entry is first created, create analytics record
  IF TG_OP = 'INSERT' THEN
    -- Calculate quoted time from ETA
    IF NEW.eta IS NOT NULL THEN
      v_quoted_time := EXTRACT(EPOCH FROM (NEW.eta - NEW.created_at))::INTEGER / 60;
    ELSE
      v_quoted_time := 20; -- default
    END IF;
    
    INSERT INTO public.waitlist_analytics (
      venue_id,
      entry_id,
      joined_at,
      quoted_wait_time,
      day_of_week,
      hour_of_day,
      party_size
    ) VALUES (
      NEW.venue_id,
      NEW.id,
      NEW.created_at,
      v_quoted_time,
      EXTRACT(DOW FROM v_local_timestamp)::INTEGER,
      EXTRACT(HOUR FROM v_local_timestamp)::INTEGER,
      NEW.party_size
    );
  END IF;
  
  -- When status changes, update analytics
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Mark when table is ready
    IF NEW.status = 'ready' THEN
      UPDATE public.waitlist_analytics
      SET 
        ready_at = now(),
        actual_wait_time = EXTRACT(EPOCH FROM (now() - joined_at))::INTEGER / 60
      WHERE entry_id = NEW.id;
    END IF;
    
    -- Mark when seated or no-show
    IF NEW.status = 'seated' THEN
      UPDATE public.waitlist_analytics
      SET seated_at = now()
      WHERE entry_id = NEW.id;
    END IF;
    
    IF NEW.status = 'no_show' THEN
      UPDATE public.waitlist_analytics
      SET was_no_show = true
      WHERE entry_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;