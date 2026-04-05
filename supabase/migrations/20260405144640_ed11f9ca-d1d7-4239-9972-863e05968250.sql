
-- Subscription Plans (dev-configurable pricing tiers)
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  annual_price numeric(10,2) NOT NULL DEFAULT 0,
  included_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Subscription Add-ons
CREATE TABLE public.subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  feature_key text NOT NULL UNIQUE,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  annual_price numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Merchant Subscriptions (per-venue)
CREATE TABLE public.merchant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'locked')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  payfast_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE(venue_id)
);

-- Subscription Add-on Assignments
CREATE TABLE public.subscription_addon_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.merchant_subscriptions(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.subscription_addons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, addon_id)
);

-- Billing Invoices
CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.merchant_subscriptions(id),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  invoice_number text NOT NULL UNIQUE,
  period_start timestamptz,
  period_end timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  stripe_invoice_id text,
  payfast_reference text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- Dev Pricing Overrides
CREATE TABLE public.dev_pricing_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  override_type text NOT NULL CHECK (override_type IN ('free', 'custom_price', 'discount_percent')),
  custom_monthly_price numeric(10,2),
  custom_annual_price numeric(10,2),
  discount_percent numeric(5,2),
  reason text,
  created_by uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(venue_id)
);

-- Promo Pricing Rules
CREATE TABLE public.promo_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_price_per_day numeric(10,2) NOT NULL DEFAULT 50,
  placement_multipliers jsonb NOT NULL DEFAULT '{"explore_page": 1.0, "home_banner": 1.5, "search_results": 1.2}'::jsonb,
  reach_tiers jsonb NOT NULL DEFAULT '[{"min_impressions": 0, "max_impressions": 1000, "multiplier": 1.0}, {"min_impressions": 1001, "max_impressions": 5000, "multiplier": 1.3}]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at triggers
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_addons_updated_at BEFORE UPDATE ON public.subscription_addons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchant_subscriptions_updated_at BEFORE UPDATE ON public.merchant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promo_pricing_rules_updated_at BEFORE UPDATE ON public.promo_pricing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_addon_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_pricing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Everyone can read plans and addons (pricing page)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active addons" ON public.subscription_addons FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active promo pricing" ON public.promo_pricing_rules FOR SELECT USING (is_active = true);

-- Super admins can manage plans, addons, overrides, promo rules
CREATE POLICY "Super admins manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage addons" ON public.subscription_addons FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage overrides" ON public.dev_pricing_overrides FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage promo pricing" ON public.promo_pricing_rules FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- Merchants can view their own subscription
CREATE POLICY "Merchants view own subscription" ON public.merchant_subscriptions FOR SELECT TO authenticated USING (venue_id = public.get_user_venue(auth.uid()));
CREATE POLICY "Super admins manage all subscriptions" ON public.merchant_subscriptions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- Addon assignments: merchants read own, super admins manage all
CREATE POLICY "Merchants view own addon assignments" ON public.subscription_addon_assignments FOR SELECT TO authenticated USING (
  subscription_id IN (SELECT id FROM public.merchant_subscriptions WHERE venue_id = public.get_user_venue(auth.uid()))
);
CREATE POLICY "Super admins manage addon assignments" ON public.subscription_addon_assignments FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

-- Invoices: merchants see own, super admins manage all
CREATE POLICY "Merchants view own invoices" ON public.billing_invoices FOR SELECT TO authenticated USING (venue_id = public.get_user_venue(auth.uid()));
CREATE POLICY "Super admins manage all invoices" ON public.billing_invoices FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
