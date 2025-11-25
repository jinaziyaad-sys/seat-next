-- Add linked_reservation_id column to support multi-table bookings
ALTER TABLE waitlist_entries 
ADD COLUMN linked_reservation_id uuid DEFAULT NULL;

-- Add index for efficient querying of linked reservations
CREATE INDEX idx_waitlist_linked_reservation 
ON waitlist_entries(linked_reservation_id) 
WHERE linked_reservation_id IS NOT NULL;