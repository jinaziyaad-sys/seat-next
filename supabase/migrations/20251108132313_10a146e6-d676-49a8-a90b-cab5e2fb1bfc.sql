-- Add awaiting_patron_confirmation column to orders table
ALTER TABLE public.orders 
ADD COLUMN awaiting_patron_confirmation boolean DEFAULT false;

-- Create index for efficient querying of orders awaiting patron confirmation
CREATE INDEX idx_orders_awaiting_patron_confirmation 
ON public.orders(venue_id, awaiting_patron_confirmation) 
WHERE awaiting_patron_confirmation = true;

-- Add comment to explain the column
COMMENT ON COLUMN public.orders.awaiting_patron_confirmation IS 'When true, indicates a patron has claimed this order and is waiting for kitchen verification';