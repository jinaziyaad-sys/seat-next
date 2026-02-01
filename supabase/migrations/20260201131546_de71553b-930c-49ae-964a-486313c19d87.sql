-- Add merchant_seen column for tracking new reservations
ALTER TABLE waitlist_entries 
ADD COLUMN IF NOT EXISTS merchant_seen BOOLEAN DEFAULT false;

-- Set existing reservations as already seen
UPDATE waitlist_entries 
SET merchant_seen = true 
WHERE reservation_type = 'reservation';