
-- 1. Update get_venue_capacity_status to use venue-local time and configured capacity
CREATE OR REPLACE FUNCTION public.get_venue_capacity_status(p_venue_id uuid)
 RETURNS TABLE(current_orders integer, current_waitlist integer, capacity_percentage numeric, is_busy boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_orders INTEGER;
  v_waitlist INTEGER;
  v_avg_orders NUMERIC;
  v_capacity_pct NUMERIC;
  v_venue_capacity INTEGER;
  v_venue_timezone TEXT;
  v_local_hour INTEGER;
  v_local_dow INTEGER;
BEGIN
  -- Get venue configured capacity and timezone
  SELECT 
    COALESCE((settings->>'venue_capacity')::INT, 40),
    COALESCE(timezone, 'Africa/Johannesburg')
  INTO v_venue_capacity, v_venue_timezone
  FROM venues WHERE id = p_venue_id;

  -- Use venue-local time for snapshot lookup
  v_local_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE v_venue_timezone))::INTEGER;
  v_local_dow := EXTRACT(DOW FROM (now() AT TIME ZONE v_venue_timezone))::INTEGER;

  -- Get current load
  SELECT COUNT(*) INTO v_orders
  FROM public.orders
  WHERE venue_id = p_venue_id
    AND status IN ('placed', 'in_prep');
  
  SELECT COUNT(*) INTO v_waitlist
  FROM public.waitlist_entries
  WHERE venue_id = p_venue_id
    AND status = 'waiting';
  
  -- Get historical average for this time using venue-local hour/dow
  SELECT AVG(cs.current_orders) INTO v_avg_orders
  FROM public.venue_capacity_snapshots cs
  WHERE cs.venue_id = p_venue_id
    AND cs.day_of_week = v_local_dow
    AND cs.hour_of_day = v_local_hour;
  
  -- Calculate capacity percentage using configured capacity as denominator
  v_capacity_pct := ((v_orders + v_waitlist)::NUMERIC / v_venue_capacity) * 100;
  
  RETURN QUERY SELECT 
    v_orders,
    v_waitlist,
    v_capacity_pct,
    v_capacity_pct > 80;
END;
$function$;

-- 2. Update calculate_dynamic_wait_time with learned turnover and recency weighting
CREATE OR REPLACE FUNCTION public.calculate_dynamic_wait_time(p_venue_id uuid, p_party_size integer, p_hour integer, p_day_of_week integer, p_current_waitlist_length integer DEFAULT 0)
 RETURNS TABLE(estimated_minutes integer, confidence_score numeric, data_points integer, base_time numeric, position_multiplier numeric, party_size_factor numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_avg_wait_time NUMERIC;
  v_data_count INTEGER;
  v_confidence NUMERIC;
  v_position_mult NUMERIC;
  v_party_mult NUMERIC;
  v_final_estimate INTEGER;
  v_per_person_rate NUMERIC;
  v_turnover_data_count INTEGER;
BEGIN
  -- Query historical data with RECENCY WEIGHTING for similar conditions
  SELECT 
    SUM(actual_wait_time * CASE
      WHEN joined_at > now() - INTERVAL '7 days' THEN 3
      WHEN joined_at > now() - INTERVAL '14 days' THEN 2
      ELSE 1
    END) / NULLIF(SUM(CASE
      WHEN joined_at > now() - INTERVAL '7 days' THEN 3
      WHEN joined_at > now() - INTERVAL '14 days' THEN 2
      ELSE 1
    END), 0),
    COUNT(*)::INTEGER
  INTO v_avg_wait_time, v_data_count
  FROM public.waitlist_analytics
  WHERE venue_id = p_venue_id
    AND day_of_week = p_day_of_week
    AND hour_of_day BETWEEN (p_hour - 2) AND (p_hour + 2)
    AND party_size BETWEEN (p_party_size - 1) AND (p_party_size + 1)
    AND actual_wait_time IS NOT NULL
    AND joined_at > (now() - INTERVAL '30 days');
  
  -- Use default if no historical data
  IF v_avg_wait_time IS NULL OR v_data_count = 0 THEN
    v_avg_wait_time := 20;
    v_data_count := 0;
  END IF;
  
  -- Calculate confidence score
  v_confidence := LEAST(100, (v_data_count::NUMERIC / 30.0) * 100);
  
  -- LEARNED TURNOVER RATE: calculate per-person wait from recent data
  SELECT 
    AVG(wa.actual_wait_time)::NUMERIC / NULLIF(AVG(wa.party_size), 0),
    COUNT(*)::INTEGER
  INTO v_per_person_rate, v_turnover_data_count
  FROM public.waitlist_analytics wa
  WHERE wa.venue_id = p_venue_id
    AND wa.actual_wait_time IS NOT NULL
    AND wa.joined_at > (now() - INTERVAL '14 days');
  
  -- Fall back to 5 min/person when insufficient data (< 5 data points)
  IF v_per_person_rate IS NULL OR v_turnover_data_count < 5 THEN
    v_per_person_rate := 5.0;
  END IF;
  
  -- Cap per-person rate to reasonable bounds (2-15 min)
  v_per_person_rate := GREATEST(2.0, LEAST(15.0, v_per_person_rate));
  
  -- Apply learned position multiplier
  v_position_mult := p_current_waitlist_length * v_per_person_rate;
  
  -- Apply party size factor (larger parties wait longer)
  v_party_mult := CASE
    WHEN p_party_size >= 6 THEN 1.2
    WHEN p_party_size >= 4 THEN 1.1
    ELSE 1.0
  END;
  
  -- Calculate final estimate
  v_final_estimate := CEIL((v_avg_wait_time + v_position_mult) * v_party_mult);
  
  RETURN QUERY SELECT 
    v_final_estimate,
    v_confidence,
    v_data_count,
    v_avg_wait_time,
    v_position_mult,
    v_party_mult;
END;
$function$;

-- 3. Update calculate_dynamic_prep_time with recency weighting
CREATE OR REPLACE FUNCTION public.calculate_dynamic_prep_time(p_venue_id uuid, p_hour integer, p_day_of_week integer, p_current_load integer DEFAULT 0)
 RETURNS TABLE(estimated_minutes integer, confidence_score numeric, data_points integer, base_time numeric, load_multiplier numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avg_prep_time NUMERIC;
  v_data_count INTEGER;
  v_confidence NUMERIC;
  v_load_mult NUMERIC;
  v_final_estimate INTEGER;
  v_venue_default_prep_time INTEGER;
BEGIN
  -- Get venue's default prep time from settings
  SELECT COALESCE((settings->>'default_prep_time')::INTEGER, 15)
  INTO v_venue_default_prep_time
  FROM public.venues
  WHERE id = p_venue_id;
  
  -- Query historical data with RECENCY WEIGHTING
  SELECT 
    SUM(actual_prep_time * CASE
      WHEN placed_at > now() - INTERVAL '7 days' THEN 3
      WHEN placed_at > now() - INTERVAL '14 days' THEN 2
      ELSE 1
    END) / NULLIF(SUM(CASE
      WHEN placed_at > now() - INTERVAL '7 days' THEN 3
      WHEN placed_at > now() - INTERVAL '14 days' THEN 2
      ELSE 1
    END), 0),
    COUNT(*)::INTEGER
  INTO v_avg_prep_time, v_data_count
  FROM public.order_analytics
  WHERE venue_id = p_venue_id
    AND day_of_week = p_day_of_week
    AND hour_of_day BETWEEN (p_hour - 2) AND (p_hour + 2)
    AND actual_prep_time IS NOT NULL
    AND placed_at > (now() - INTERVAL '30 days');
  
  -- Use venue's configured default instead of hardcoded 15
  IF v_avg_prep_time IS NULL OR v_data_count = 0 THEN
    v_avg_prep_time := v_venue_default_prep_time;
    v_data_count := 0;
  END IF;
  
  -- Calculate confidence score based on data points
  v_confidence := LEAST(100, (v_data_count::NUMERIC / 30.0) * 100);
  
  -- Apply load multiplier based on current kitchen load
  v_load_mult := CASE
    WHEN p_current_load <= 3 THEN 1.0
    WHEN p_current_load <= 7 THEN 1.3
    ELSE 1.6
  END;
  
  -- Calculate final estimate
  v_final_estimate := CEIL(v_avg_prep_time * v_load_mult);
  
  RETURN QUERY SELECT 
    v_final_estimate,
    v_confidence,
    v_data_count,
    v_avg_prep_time,
    v_load_mult;
END;
$function$;
