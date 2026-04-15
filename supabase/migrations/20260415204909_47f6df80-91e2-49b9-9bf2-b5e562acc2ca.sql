
CREATE OR REPLACE FUNCTION public.increment_promo_impressions(campaign_uuid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE promo_campaigns
  SET impressions_count = impressions_count + 1
  WHERE id = campaign_uuid;
$$;

CREATE OR REPLACE FUNCTION public.increment_promo_clicks(campaign_uuid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE promo_campaigns
  SET clicks_count = clicks_count + 1
  WHERE id = campaign_uuid;
$$;
