-- Add merchant_dismissed column to orders table for soft-delete functionality
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS merchant_dismissed boolean NOT NULL DEFAULT false;

-- Add index for faster dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_venue_dismissed_status 
ON public.orders (venue_id, merchant_dismissed, status, created_at);