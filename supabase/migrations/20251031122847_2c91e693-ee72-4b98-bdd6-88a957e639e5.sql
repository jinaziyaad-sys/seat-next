-- Add service_types column to venues table
-- This allows each venue to specify which services they offer:
-- 'food_ready' for pickup/takeout orders
-- 'table_ready' for dine-in with waitlist
-- Default to both services for existing venues

ALTER TABLE public.venues 
ADD COLUMN service_types TEXT[] DEFAULT ARRAY['food_ready', 'table_ready'];

-- Add a check constraint to ensure at least one service type is selected
ALTER TABLE public.venues
ADD CONSTRAINT venues_service_types_not_empty 
CHECK (array_length(service_types, 1) > 0);

-- Add a check constraint to ensure only valid service types
ALTER TABLE public.venues
ADD CONSTRAINT venues_service_types_valid
CHECK (service_types <@ ARRAY['food_ready', 'table_ready']);