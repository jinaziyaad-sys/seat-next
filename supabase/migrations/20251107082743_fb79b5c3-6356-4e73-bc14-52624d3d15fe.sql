-- Add reservation fields to waitlist_entries
ALTER TABLE public.waitlist_entries 
ADD COLUMN IF NOT EXISTS reservation_time timestamptz,
ADD COLUMN IF NOT EXISTS reservation_type text DEFAULT 'walk_in' CHECK (reservation_type IN ('walk_in', 'reservation'));

-- Create index for querying reservations by date/time
CREATE INDEX IF NOT EXISTS idx_waitlist_reservation_time 
ON public.waitlist_entries(venue_id, reservation_time) 
WHERE reservation_type = 'reservation';

-- Create index for reservation queries with status
CREATE INDEX IF NOT EXISTS idx_waitlist_reservations_status 
ON public.waitlist_entries(venue_id, reservation_time, status) 
WHERE reservation_type = 'reservation';