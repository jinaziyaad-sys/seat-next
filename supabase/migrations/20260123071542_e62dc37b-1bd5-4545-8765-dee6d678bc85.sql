-- Add columns to track reservation edits
ALTER TABLE public.waitlist_entries 
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edit_summary TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN public.waitlist_entries.last_edited_at IS 'Timestamp when the reservation was last edited by patron';
COMMENT ON COLUMN public.waitlist_entries.edit_summary IS 'Summary of what changed in the last edit (e.g., "Party size: 4→6, Time: 18:00→19:00")';