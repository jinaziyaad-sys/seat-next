
-- merchant_subscriptions table already exists per types.ts, but dev_pricing_overrides needs to be created
-- Check: dev_pricing_overrides also exists per types.ts
-- Both tables exist. We just need RLS policies.

-- RLS for merchant_subscriptions
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own venue's subscription
CREATE POLICY "Merchants can view own venue subscription"
ON public.merchant_subscriptions
FOR SELECT
TO authenticated
USING (venue_id = public.get_user_venue(auth.uid()));

-- Service role (edge functions) can manage all subscriptions - handled by service_role key
-- Super admins can view all subscriptions
CREATE POLICY "Super admins can view all subscriptions"
ON public.merchant_subscriptions
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admins can manage all subscriptions
CREATE POLICY "Super admins can manage subscriptions"
ON public.merchant_subscriptions
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- RLS for dev_pricing_overrides
ALTER TABLE public.dev_pricing_overrides ENABLE ROW LEVEL SECURITY;

-- Only super admins can view overrides
CREATE POLICY "Super admins can view pricing overrides"
ON public.dev_pricing_overrides
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Only super admins can manage overrides
CREATE POLICY "Super admins can manage pricing overrides"
ON public.dev_pricing_overrides
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
