-- Add notes column to waitlist_entries table to store extension reasons and other merchant communication
ALTER TABLE waitlist_entries 
ADD COLUMN notes text;

-- Add comment for documentation
COMMENT ON COLUMN waitlist_entries.notes IS 'Stores extension reasons, cancellation notes, and other merchant communication';