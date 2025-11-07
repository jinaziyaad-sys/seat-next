-- Add patron delay tracking columns to waitlist_entries
ALTER TABLE public.waitlist_entries 
ADD COLUMN patron_delayed boolean DEFAULT false,
ADD COLUMN delayed_until timestamp with time zone DEFAULT NULL;

-- Add index for querying delayed patrons
CREATE INDEX idx_waitlist_patron_delayed 
ON public.waitlist_entries(venue_id, patron_delayed) 
WHERE patron_delayed = true;