-- Remove unsafe arbitrary SQL executor
DROP FUNCTION IF EXISTS public.execute_readonly_query(TEXT);

-- Tighten ai_operations_log insert policy (was WITH CHECK true)
DROP POLICY IF EXISTS "System can insert AI operations log" ON public.ai_operations_log;

CREATE POLICY "Super admins can insert AI operations log"
ON public.ai_operations_log
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Create safe analytics helper RPCs (no dynamic SQL)
CREATE OR REPLACE FUNCTION public.analytics_top_venue_orders_this_week(p_limit INTEGER DEFAULT 5)
RETURNS TABLE(venue_name TEXT, total_orders BIGINT)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super admin required';
  END IF;

  RETURN QUERY
  SELECT v.name AS venue_name, COUNT(o.id)::BIGINT AS total_orders
  FROM public.venues v
  JOIN public.orders o ON o.venue_id = v.id
  WHERE o.created_at >= date_trunc('week', now())
  GROUP BY v.name
  ORDER BY total_orders DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_top_venue_orders_last_7_days(p_limit INTEGER DEFAULT 5)
RETURNS TABLE(venue_name TEXT, total_orders BIGINT)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super admin required';
  END IF;

  RETURN QUERY
  SELECT v.name AS venue_name, COUNT(o.id)::BIGINT AS total_orders
  FROM public.venues v
  JOIN public.orders o ON o.venue_id = v.id
  WHERE o.created_at >= (now() - INTERVAL '7 days')
  GROUP BY v.name
  ORDER BY total_orders DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_avg_wait_time_all_time()
RETURNS TABLE(avg_wait_time_minutes NUMERIC)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super admin required';
  END IF;

  RETURN QUERY
  SELECT AVG(wa.actual_wait_time)::NUMERIC AS avg_wait_time_minutes
  FROM public.waitlist_analytics wa
  WHERE wa.actual_wait_time IS NOT NULL;
END;
$$;