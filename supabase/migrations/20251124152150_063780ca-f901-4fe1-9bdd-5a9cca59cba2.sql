-- First, handle existing duplicate bookings by cancelling older duplicates
-- Keep the most recent booking for each (user_id, venue_id, reservation_time) combination
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, venue_id, reservation_time 
      ORDER BY created_at DESC
    ) as rn
  FROM waitlist_entries
  WHERE reservation_type = 'reservation' 
    AND status NOT IN ('cancelled', 'no_show', 'seated')
    AND reservation_time IS NOT NULL
    AND user_id IS NOT NULL
)
UPDATE waitlist_entries
SET 
  status = 'cancelled',
  cancellation_reason = 'Duplicate booking removed by system',
  updated_at = now()
FROM duplicates
WHERE waitlist_entries.id = duplicates.id
  AND duplicates.rn > 1;

-- Now add the unique constraint to prevent future duplicates
CREATE UNIQUE INDEX unique_active_reservation_per_user_time 
ON waitlist_entries (user_id, venue_id, reservation_time)
WHERE reservation_type = 'reservation' 
  AND status NOT IN ('cancelled', 'no_show', 'seated')
  AND reservation_time IS NOT NULL
  AND user_id IS NOT NULL;