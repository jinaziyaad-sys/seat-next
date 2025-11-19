-- Add original_eta column to orders table to track initial ETA
ALTER TABLE orders 
ADD COLUMN original_eta timestamp with time zone;

-- Backfill existing orders with current ETA as best guess
UPDATE orders 
SET original_eta = eta 
WHERE original_eta IS NULL AND eta IS NOT NULL;

-- Add original_eta column to waitlist_entries table
ALTER TABLE waitlist_entries 
ADD COLUMN original_eta timestamp with time zone;

-- Backfill existing waitlist entries with current ETA
UPDATE waitlist_entries 
SET original_eta = eta 
WHERE original_eta IS NULL AND eta IS NOT NULL;