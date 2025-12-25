-- First clean up duplicate active orders, keeping only the earliest one
DELETE FROM orders o1
WHERE o1.id IN (
  SELECT o2.id 
  FROM orders o2
  WHERE o2.status NOT IN ('collected', 'rejected', 'cancelled')
  AND EXISTS (
    SELECT 1 FROM orders o3 
    WHERE o3.venue_id = o2.venue_id 
    AND o3.order_number = o2.order_number 
    AND o3.user_id = o2.user_id
    AND o3.status NOT IN ('collected', 'rejected', 'cancelled')
    AND o3.created_at < o2.created_at
  )
);

-- Now create unique partial index to prevent duplicate active orders
CREATE UNIQUE INDEX IF NOT EXISTS orders_venue_order_user_active_unique 
ON orders (venue_id, order_number, user_id) 
WHERE status NOT IN ('collected', 'rejected', 'cancelled');