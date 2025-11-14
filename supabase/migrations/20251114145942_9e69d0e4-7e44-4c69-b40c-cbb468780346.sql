-- Add cancellation_reason field to waitlist_entries
ALTER TABLE public.waitlist_entries
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;