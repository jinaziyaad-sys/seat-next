-- Phase 1: Analytics-Driven Dynamic Wait & Prep Times Database Schema

-- ============================================================================
-- 1. CREATE ANALYTICS TABLES
-- ============================================================================

-- Order Analytics Table
CREATE TABLE IF NOT EXISTS public.order_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  placed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  in_prep_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  collected_at TIMESTAMP WITH TIME ZONE,
  quoted_prep_time INTEGER NOT NULL,
  actual_prep_time INTEGER,
  day_of_week INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL,
  items_count INTEGER NOT NULL DEFAULT 0,
  delay_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_analytics_venue_time ON public.order_analytics(venue_id, day_of_week, hour_of_day);
CREATE INDEX idx_order_analytics_placed_at ON public.order_analytics(placed_at);

-- Waitlist Analytics Table
CREATE TABLE IF NOT EXISTS public.waitlist_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.waitlist_entries(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ready_at TIMESTAMP WITH TIME ZONE,
  seated_at TIMESTAMP WITH TIME ZONE,
  quoted_wait_time INTEGER NOT NULL,
  actual_wait_time INTEGER,
  day_of_week INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL,
  party_size INTEGER NOT NULL,
  was_no_show BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_analytics_venue_time ON public.waitlist_analytics(venue_id, day_of_week, hour_of_day);
CREATE INDEX idx_waitlist_analytics_party_size ON public.waitlist_analytics(venue_id, party_size);
CREATE INDEX idx_waitlist_analytics_joined_at ON public.waitlist_analytics(joined_at);

-- Venue Capacity Snapshots Table
CREATE TABLE IF NOT EXISTS public.venue_capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_orders INTEGER NOT NULL DEFAULT 0,
  current_waitlist INTEGER NOT NULL DEFAULT 0,
  tables_occupied INTEGER DEFAULT 0,
  day_of_week INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL
);

CREATE INDEX idx_capacity_snapshots_venue_time ON public.venue_capacity_snapshots(venue_id, day_of_week, hour_of_day);

-- ============================================================================
-- 2. CREATE DATABASE FUNCTIONS
-- ============================================================================

-- Function: Calculate Dynamic Prep Time
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
BEGIN
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
  
  -- Use default if no historical data
  IF v_avg_prep_time IS NULL OR v_data_count = 0 THEN
    v_avg_prep_time := 15;
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

-- Function: Calculate Dynamic Wait Time
CREATE OR REPLACE FUNCTION public.calculate_dynamic_wait_time(
  p_venue_id UUID,
  p_party_size INTEGER,
  p_hour INTEGER,
  p_day_of_week INTEGER,
  p_current_waitlist_length INTEGER DEFAULT 0
)
RETURNS TABLE(
  estimated_minutes INTEGER,
  confidence_score NUMERIC,
  data_points INTEGER,
  base_time NUMERIC,
  position_multiplier NUMERIC,
  party_size_factor NUMERIC
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_avg_wait_time NUMERIC;
  v_data_count INTEGER;
  v_confidence NUMERIC;
  v_position_mult NUMERIC;
  v_party_mult NUMERIC;
  v_final_estimate INTEGER;
BEGIN
  -- Query historical data for similar conditions
  SELECT 
    AVG(actual_wait_time)::NUMERIC,
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
  
  -- Apply position multiplier (5 minutes per position in queue)
  v_position_mult := p_current_waitlist_length * 5;
  
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
$$;

-- Function: Get Venue Capacity Status
CREATE OR REPLACE FUNCTION public.get_venue_capacity_status(p_venue_id UUID)
RETURNS TABLE(
  current_orders INTEGER,
  current_waitlist INTEGER,
  capacity_percentage NUMERIC,
  is_busy BOOLEAN
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_orders INTEGER;
  v_waitlist INTEGER;
  v_avg_orders NUMERIC;
  v_capacity_pct NUMERIC;
BEGIN
  -- Get current load
  SELECT COUNT(*) INTO v_orders
  FROM public.orders
  WHERE venue_id = p_venue_id
    AND status IN ('placed', 'in_prep');
  
  SELECT COUNT(*) INTO v_waitlist
  FROM public.waitlist_entries
  WHERE venue_id = p_venue_id
    AND status = 'waiting';
  
  -- Get historical average for this time
  SELECT AVG(current_orders) INTO v_avg_orders
  FROM public.venue_capacity_snapshots
  WHERE venue_id = p_venue_id
    AND day_of_week = EXTRACT(DOW FROM now())::INTEGER
    AND hour_of_day = EXTRACT(HOUR FROM now())::INTEGER;
  
  -- Calculate capacity percentage (max 10 orders as baseline)
  IF v_avg_orders > 0 THEN
    v_capacity_pct := (v_orders::NUMERIC / v_avg_orders) * 100;
  ELSE
    v_capacity_pct := (v_orders::NUMERIC / 10) * 100;
  END IF;
  
  RETURN QUERY SELECT 
    v_orders,
    v_waitlist,
    v_capacity_pct,
    v_capacity_pct > 80;
END;
$$;

-- ============================================================================
-- 3. CREATE TRIGGERS FOR AUTOMATIC ANALYTICS COLLECTION
-- ============================================================================

-- Trigger Function: Track Order Analytics
CREATE OR REPLACE FUNCTION public.track_order_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS trigger_track_order_analytics ON public.orders;
CREATE TRIGGER trigger_track_order_analytics
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_order_analytics();

-- Trigger Function: Track Waitlist Analytics
CREATE OR REPLACE FUNCTION public.track_waitlist_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quoted_time INTEGER;
  v_actual_time INTEGER;
BEGIN
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
      EXTRACT(DOW FROM NEW.created_at)::INTEGER,
      EXTRACT(HOUR FROM NEW.created_at)::INTEGER,
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
$$;

-- Attach trigger to waitlist_entries table
DROP TRIGGER IF EXISTS trigger_track_waitlist_analytics ON public.waitlist_entries;
CREATE TRIGGER trigger_track_waitlist_analytics
  AFTER INSERT OR UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.track_waitlist_analytics();

-- ============================================================================
-- 4. ENABLE RLS ON ANALYTICS TABLES
-- ============================================================================

ALTER TABLE public.order_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_capacity_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_analytics
CREATE POLICY "Staff can view venue order analytics"
  ON public.order_analytics FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
    ) OR is_super_admin(auth.uid())
  );

-- RLS Policies for waitlist_analytics
CREATE POLICY "Staff can view venue waitlist analytics"
  ON public.waitlist_analytics FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
    ) OR is_super_admin(auth.uid())
  );

-- RLS Policies for venue_capacity_snapshots
CREATE POLICY "Staff can view venue capacity snapshots"
  ON public.venue_capacity_snapshots FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
    ) OR is_super_admin(auth.uid())
  );

-- System can insert capacity snapshots
CREATE POLICY "System can insert capacity snapshots"
  ON public.venue_capacity_snapshots FOR INSERT
  WITH CHECK (true);