-- Add confidence tracking to orders and waitlist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS confidence TEXT CHECK (confidence IN ('low', 'medium', 'high'));

ALTER TABLE public.waitlist_entries 
ADD COLUMN IF NOT EXISTS confidence TEXT CHECK (confidence IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.orders.confidence IS 'ETA confidence level based on historical data availability: high (30+ data points), medium (10-29), low (<10)';
COMMENT ON COLUMN public.waitlist_entries.confidence IS 'ETA confidence level based on historical data availability: high (30+ data points), medium (10-29), low (<10)';