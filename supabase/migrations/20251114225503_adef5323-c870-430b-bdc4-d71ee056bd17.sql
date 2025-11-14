-- Add latitude and longitude to venues table for GPS tracking
ALTER TABLE public.venues 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

COMMENT ON COLUMN public.venues.latitude IS 'Venue latitude for GPS tracking';
COMMENT ON COLUMN public.venues.longitude IS 'Venue longitude for GPS tracking';