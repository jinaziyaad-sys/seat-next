
-- Create promo_targeting_rules table
CREATE TABLE public.promo_targeting_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  location_radius_km INTEGER,
  location_lat NUMERIC,
  location_lng NUMERIC,
  cuisine_tags TEXT[] DEFAULT '{}',
  target_past_visitors BOOLEAN DEFAULT false,
  time_slots JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id)
);

ALTER TABLE public.promo_targeting_rules ENABLE ROW LEVEL SECURITY;

-- Venue admins can manage their own campaign targeting
CREATE POLICY "Venue admins can manage targeting rules"
ON public.promo_targeting_rules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.promo_campaigns pc
    JOIN public.user_roles ur ON ur.venue_id = pc.venue_id
    WHERE pc.id = promo_targeting_rules.campaign_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'admin'
  ) OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.promo_campaigns pc
    JOIN public.user_roles ur ON ur.venue_id = pc.venue_id
    WHERE pc.id = promo_targeting_rules.campaign_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'admin'
  ) OR is_super_admin(auth.uid())
);

-- Anyone authenticated can read targeting rules (needed for patron-side filtering)
CREATE POLICY "Authenticated users can read targeting rules"
ON public.promo_targeting_rules
FOR SELECT
TO authenticated
USING (true);

-- Add targeting columns to promo_campaigns
ALTER TABLE public.promo_campaigns
ADD COLUMN IF NOT EXISTS targeting_type TEXT NOT NULL DEFAULT 'broad',
ADD COLUMN IF NOT EXISTS estimated_reach INTEGER DEFAULT 0;

-- Add targeting match tracking to promo_impressions
ALTER TABLE public.promo_impressions
ADD COLUMN IF NOT EXISTS targeting_match_type TEXT;

-- Trigger for updated_at
CREATE TRIGGER update_promo_targeting_rules_updated_at
BEFORE UPDATE ON public.promo_targeting_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
