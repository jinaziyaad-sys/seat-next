-- Add waitlist preferences to venues table
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS waitlist_preferences jsonb DEFAULT '{"options": [{"id": "indoor", "label": "Indoor Seating", "enabled": true}, {"id": "outdoor", "label": "Outdoor Seating", "enabled": true}, {"id": "smoking", "label": "Smoking Area", "enabled": false}]}'::jsonb;