-- Add display_address field to venues table
ALTER TABLE public.venues 
ADD COLUMN display_address TEXT;