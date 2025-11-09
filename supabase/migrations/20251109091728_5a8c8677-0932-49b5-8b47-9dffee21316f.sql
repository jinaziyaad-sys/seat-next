-- Create index for quick filtering of verification requests
CREATE INDEX IF NOT EXISTS idx_orders_awaiting_verification 
ON public.orders(venue_id, status) 
WHERE status = 'awaiting_verification';