-- Add staff attribution to orders table
ALTER TABLE public.orders 
ADD COLUMN prepared_by_staff_id UUID REFERENCES public.profiles(id),
ADD COLUMN marked_ready_by_staff_id UUID REFERENCES public.profiles(id);

-- Create customer_analytics table for tracking customer behavior
CREATE TABLE public.customer_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  first_order_date TIMESTAMPTZ,
  last_order_date TIMESTAMPTZ,
  first_waitlist_date TIMESTAMPTZ,
  last_waitlist_date TIMESTAMPTZ,
  total_orders INTEGER DEFAULT 0,
  total_waitlist_joins INTEGER DEFAULT 0,
  avg_rating_given NUMERIC,
  days_since_last_visit INTEGER,
  visit_frequency_days NUMERIC,
  customer_segment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

-- Enable RLS on customer_analytics
ALTER TABLE public.customer_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view venue customer analytics
CREATE POLICY "Staff can view venue customer analytics"
ON public.customer_analytics FOR SELECT
USING (
  venue_id IN (SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

-- Trigger function to update customer analytics on order completion
CREATE OR REPLACE FUNCTION public.update_customer_analytics_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_between NUMERIC;
  v_last_order_date TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'collected' AND (OLD.status IS NULL OR OLD.status != 'collected') AND NEW.user_id IS NOT NULL THEN
    -- Get last order date before this one
    SELECT last_order_date INTO v_last_order_date
    FROM public.customer_analytics
    WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
    
    -- Calculate days between visits if there was a previous visit
    IF v_last_order_date IS NOT NULL THEN
      v_days_between := EXTRACT(EPOCH FROM (NEW.created_at - v_last_order_date))/86400;
    END IF;
    
    -- Insert or update customer analytics
    INSERT INTO public.customer_analytics (
      user_id, 
      venue_id, 
      first_order_date, 
      last_order_date, 
      total_orders, 
      visit_frequency_days,
      days_since_last_visit
    )
    VALUES (
      NEW.user_id, 
      NEW.venue_id, 
      NEW.created_at, 
      NEW.created_at, 
      1, 
      NULL,
      0
    )
    ON CONFLICT (user_id, venue_id) 
    DO UPDATE SET 
      last_order_date = NEW.created_at,
      total_orders = customer_analytics.total_orders + 1,
      visit_frequency_days = CASE 
        WHEN customer_analytics.total_orders = 1 THEN v_days_between
        WHEN v_days_between IS NOT NULL THEN 
          (COALESCE(customer_analytics.visit_frequency_days, 0) * (customer_analytics.total_orders - 1) + v_days_between) / customer_analytics.total_orders
        ELSE customer_analytics.visit_frequency_days
      END,
      days_since_last_visit = 0,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for order analytics
CREATE TRIGGER on_order_completed_update_customer_analytics
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_analytics_on_order();

-- Trigger function to update customer analytics on waitlist seating
CREATE OR REPLACE FUNCTION public.update_customer_analytics_on_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_between NUMERIC;
  v_last_waitlist_date TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') AND NEW.user_id IS NOT NULL THEN
    -- Get last waitlist date before this one
    SELECT last_waitlist_date INTO v_last_waitlist_date
    FROM public.customer_analytics
    WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
    
    -- Insert or update customer analytics
    INSERT INTO public.customer_analytics (
      user_id, 
      venue_id, 
      first_waitlist_date, 
      last_waitlist_date, 
      total_waitlist_joins
    )
    VALUES (
      NEW.user_id, 
      NEW.venue_id, 
      NEW.created_at, 
      NEW.created_at, 
      1
    )
    ON CONFLICT (user_id, venue_id) 
    DO UPDATE SET 
      last_waitlist_date = NEW.created_at,
      total_waitlist_joins = customer_analytics.total_waitlist_joins + 1,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for waitlist analytics
CREATE TRIGGER on_waitlist_seated_update_customer_analytics
AFTER UPDATE ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_analytics_on_waitlist();

-- Trigger to update days_since_last_visit daily
CREATE OR REPLACE FUNCTION public.update_customer_days_since_visit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customer_analytics
  SET 
    days_since_last_visit = EXTRACT(EPOCH FROM (now() - COALESCE(last_order_date, last_waitlist_date)))::INTEGER / 86400,
    customer_segment = CASE
      WHEN total_orders = 1 AND EXTRACT(EPOCH FROM (now() - COALESCE(last_order_date, last_waitlist_date)))::INTEGER / 86400 < 30 THEN 'new'
      WHEN total_orders >= 2 AND EXTRACT(EPOCH FROM (now() - COALESCE(last_order_date, last_waitlist_date)))::INTEGER / 86400 < 14 THEN 'active'
      WHEN total_orders >= 5 AND EXTRACT(EPOCH FROM (now() - COALESCE(last_order_date, last_waitlist_date)))::INTEGER / 86400 < 30 THEN 'regular'
      WHEN total_orders >= 3 AND EXTRACT(EPOCH FROM (now() - COALESCE(last_order_date, last_waitlist_date)))::INTEGER / 86400 >= 30 AND EXTRACT(EPOCH FROM (now() - COALESCE(last_order_date, last_waitlist_date)))::INTEGER / 86400 < 60 THEN 'at_risk'
      ELSE 'inactive'
    END,
    updated_at = now()
  WHERE COALESCE(last_order_date, last_waitlist_date) IS NOT NULL;
END;
$$;

-- Create daily_venue_snapshots table for trend analysis
CREATE TABLE public.daily_venue_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  avg_prep_time_minutes NUMERIC,
  on_time_percentage NUMERIC,
  total_waitlist_joins INTEGER DEFAULT 0,
  avg_wait_time_minutes NUMERIC,
  total_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,
  avg_rating NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue_id, snapshot_date)
);

-- Enable RLS on daily_venue_snapshots
ALTER TABLE public.daily_venue_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view venue snapshots
CREATE POLICY "Staff can view venue snapshots"
ON public.daily_venue_snapshots FOR SELECT
USING (
  venue_id IN (SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

-- RLS Policy: System can insert snapshots
CREATE POLICY "System can insert snapshots"
ON public.daily_venue_snapshots FOR INSERT
WITH CHECK (true);