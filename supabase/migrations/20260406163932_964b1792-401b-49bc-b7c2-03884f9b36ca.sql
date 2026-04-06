-- Allow venue staff to insert promo campaigns for their venue
CREATE POLICY "Venue staff can insert campaigns"
ON public.promo_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (
    SELECT venue_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Allow venue staff to view their own venue campaigns
CREATE POLICY "Venue staff can view own campaigns"
ON public.promo_campaigns
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Allow venue staff to update their own venue campaigns
CREATE POLICY "Venue staff can update own campaigns"
ON public.promo_campaigns
FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Seed default promo pricing rule
INSERT INTO public.promo_pricing_rules (base_price_per_day, placement_multipliers, reach_tiers, is_active)
VALUES (
  50,
  '{"home": 1.0, "explore": 0.8, "tracking": 0.6, "push": 1.5}'::jsonb,
  '[{"min_days": 1, "max_days": 7, "multiplier": 1.0}, {"min_days": 8, "max_days": 30, "multiplier": 0.9}, {"min_days": 31, "max_days": 365, "multiplier": 0.8}]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;