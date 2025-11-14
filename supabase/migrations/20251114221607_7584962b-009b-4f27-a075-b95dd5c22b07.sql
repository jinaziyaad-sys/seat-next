-- Update calculate_dynamic_prep_time to use venue's default prep time from settings
CREATE OR REPLACE FUNCTION public.calculate_dynamic_prep_time(
  p_venue_id UUID,
  p_hour INTEGER,
  p_day_of_week INTEGER,
  p_current_load INTEGER DEFAULT 0
)
RETURNS TABLE(
  estimated_minutes INTEGER,
  confidence_score NUMERIC,
  data_points INTEGER,
  base_time NUMERIC,
  load_multiplier NUMERIC
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_avg_prep_time NUMERIC;
  v_data_count INTEGER;
  v_confidence NUMERIC;
  v_load_mult NUMERIC;
  v_final_estimate INTEGER;
  v_venue_default_prep_time INTEGER;
BEGIN
  -- Get venue's default prep time from settings (defaults to 15 if not set)
  SELECT COALESCE((settings->>'default_prep_time')::INTEGER, 15)
  INTO v_venue_default_prep_time
  FROM public.venues
  WHERE id = p_venue_id;
  
  -- Query historical data for similar time windows (±2 hours, same day of week)
  SELECT 
    AVG(actual_prep_time)::NUMERIC,
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
$$;