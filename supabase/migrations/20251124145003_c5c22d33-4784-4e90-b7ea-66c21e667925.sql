-- Add assigned_table_id to waitlist_entries
ALTER TABLE waitlist_entries 
ADD COLUMN IF NOT EXISTS assigned_table_id TEXT;

-- Create function to get occupied tables in a time slot
CREATE OR REPLACE FUNCTION get_occupied_tables(
  p_venue_id UUID,
  p_time_slot TIMESTAMPTZ,
  p_buffer_minutes INTEGER DEFAULT 30
)
RETURNS TABLE(table_id TEXT, party_size INTEGER, customer_name TEXT, reservation_time TIMESTAMPTZ) AS $$
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
$$ LANGUAGE plpgsql STABLE;