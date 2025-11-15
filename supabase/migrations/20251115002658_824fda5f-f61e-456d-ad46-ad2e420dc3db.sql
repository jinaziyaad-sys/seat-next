-- Remove strict unique constraint on order numbers to allow time-based reuse
-- Duplicate checking will be handled at the application level
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_venue_id_order_number_key;