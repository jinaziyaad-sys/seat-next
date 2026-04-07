
CREATE TABLE public.plan_currency_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  monthly_price NUMERIC NOT NULL,
  annual_price NUMERIC NOT NULL,
  stripe_monthly_price_id TEXT,
  stripe_annual_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, currency)
);

ALTER TABLE public.plan_currency_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage overrides" ON public.plan_currency_overrides
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can read overrides" ON public.plan_currency_overrides
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.exchange_rate_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'ZAR',
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

ALTER TABLE public.exchange_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exchange rates" ON public.exchange_rate_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages exchange rates" ON public.exchange_rate_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
