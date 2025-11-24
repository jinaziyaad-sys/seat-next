-- Fix search_path for get_occupied_tables function
CREATE OR REPLACE FUNCTION get_occupied_tables(
  p_venue_id UUID,
  p_time_slot TIMESTAMPTZ,
  p_buffer_minutes INTEGER DEFAULT 30
)
RETURNS TABLE(table_id TEXT, party_size INTEGER, customer_name TEXT, reservation_time TIMESTAMPTZ) 
LANGUAGE plpgsql 
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    assigned_table_id,
    we.party_size,
    we.customer_name,
    we.reservation_time
  FROM waitlist_entries we
  WHERE we.venue_id = p_venue_id
    AND we.reservation_type = 'reservation'
    AND we.status NOT IN ('cancelled', 'no_show', 'seated')
    AND we.assigned_table_id IS NOT NULL
    AND we.reservation_time >= (p_time_slot - (p_buffer_minutes || ' minutes')::INTERVAL)
    AND we.reservation_time <= (p_time_slot + (p_buffer_minutes || ' minutes')::INTERVAL);
END;
$$;