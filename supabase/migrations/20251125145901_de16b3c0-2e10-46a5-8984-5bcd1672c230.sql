-- Drop the existing constraint that blocks multi-table bookings
DROP INDEX IF EXISTS public.unique_active_reservation_per_user_time;

-- Recreate with exclusion for linked reservations (multi-table bookings)
-- This allows multiple entries with the same user_id, venue_id, and reservation_time
-- when they are part of a multi-table booking (linked_reservation_id IS NOT NULL)
CREATE UNIQUE INDEX unique_active_reservation_per_user_time 
ON public.waitlist_entries 
USING btree (user_id, venue_id, reservation_time) 
WHERE (
  reservation_type = 'reservation' AND 
  status NOT IN ('cancelled', 'no_show', 'seated') AND 
  reservation_time IS NOT NULL AND 
  user_id IS NOT NULL AND
  linked_reservation_id IS NULL  -- Only enforce uniqueness for single-table reservations
);