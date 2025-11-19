-- Add cancelled_by column to orders table to track who initiated cancellation
ALTER TABLE orders 
ADD COLUMN cancelled_by TEXT CHECK (cancelled_by IN ('patron', 'venue', 'system'));

-- Add cancelled_by column to waitlist_entries table to track who initiated cancellation
ALTER TABLE waitlist_entries 
ADD COLUMN cancelled_by TEXT CHECK (cancelled_by IN ('patron', 'venue', 'system'));