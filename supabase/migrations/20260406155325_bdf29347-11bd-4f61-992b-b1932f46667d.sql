
ALTER TABLE public.subscription_plans 
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_annual_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_annual_price_id text;

-- Seed existing Stripe IDs into the plans
UPDATE public.subscription_plans SET
  stripe_product_id = 'prod_UHQvy6yev2Z4FJ',
  stripe_annual_product_id = 'prod_UHRVRONaVJns9q',
  stripe_monthly_price_id = 'price_1TIs3WRrnmiHUS0LBQ9DkJlO',
  stripe_annual_price_id = 'price_1TIscARrnmiHUS0LYvmnYFDl'
WHERE LOWER(name) = 'starter';

UPDATE public.subscription_plans SET
  stripe_product_id = 'prod_UHQvBPLpLypA0e',
  stripe_annual_product_id = 'prod_UHRVAz3q59g5Vm',
  stripe_monthly_price_id = 'price_1TIs3pRrnmiHUS0LaAn8xvUy',
  stripe_annual_price_id = 'price_1TIscHRrnmiHUS0Lt8fOF8aP'
WHERE LOWER(name) = 'pro';

UPDATE public.subscription_plans SET
  stripe_product_id = 'prod_UHQwZRXj29yoYZ',
  stripe_annual_product_id = 'prod_UHTdy0VRFEXVQe',
  stripe_monthly_price_id = 'price_1TIs4JRrnmiHUS0LYSuWZptR',
  stripe_annual_price_id = 'price_1TIufsRrnmiHUS0LTTWh2jVo'
WHERE LOWER(name) = 'enterprise';
