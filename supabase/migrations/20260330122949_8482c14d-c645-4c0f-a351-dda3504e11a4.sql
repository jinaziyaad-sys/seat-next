
-- ============================================
-- 1. LOYALTY TIERS (VIP)
-- ============================================
CREATE TABLE public.loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  tier_name text NOT NULL,
  min_lifetime_stamps integer DEFAULT 0,
  min_lifetime_points integer DEFAULT 0,
  perks jsonb DEFAULT '[]'::jsonb,
  color text DEFAULT '#FFD700',
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers" ON public.loyalty_tiers
  FOR SELECT USING (true);

CREATE POLICY "Venue admins can manage tiers" ON public.loyalty_tiers
  FOR ALL TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()));

-- ============================================
-- 2. PATRON TIER STATUS
-- ============================================
CREATE TABLE public.patron_tier_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  current_tier_id uuid REFERENCES public.loyalty_tiers(id) ON DELETE SET NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, venue_id)
);

ALTER TABLE public.patron_tier_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tier status" ON public.patron_tier_status
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Staff can view venue tier status" ON public.patron_tier_status
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- ============================================
-- 3. VENUE CASHBACK CONFIG
-- ============================================
CREATE TABLE public.venue_cashback_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE UNIQUE,
  percentage numeric NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT false,
  min_order_value numeric DEFAULT 0,
  max_credit_per_order numeric DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venue_cashback_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active cashback config" ON public.venue_cashback_config
  FOR SELECT USING (true);

CREATE POLICY "Venue admins can manage cashback config" ON public.venue_cashback_config
  FOR ALL TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()));

-- ============================================
-- 4. PATRON CASHBACK BALANCE
-- ============================================
CREATE TABLE public.patron_cashback_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  lifetime_earned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, venue_id)
);

ALTER TABLE public.patron_cashback_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cashback balance" ON public.patron_cashback_balance
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Staff can view venue cashback balances" ON public.patron_cashback_balance
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- ============================================
-- 5. REFERRAL CODES
-- ============================================
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, venue_id)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral codes" ON public.referral_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral codes" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view venue referral codes" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- ============================================
-- 6. REFERRAL COMPLETIONS
-- ============================================
CREATE TABLE public.referral_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  referrer_reward_type text DEFAULT 'stamps',
  referrer_reward_value integer DEFAULT 1,
  referee_reward_type text DEFAULT 'stamps',
  referee_reward_value integer DEFAULT 1,
  referrer_rewarded boolean NOT NULL DEFAULT false,
  referee_rewarded boolean NOT NULL DEFAULT false,
  UNIQUE (referee_id, venue_id)
);

ALTER TABLE public.referral_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral completions" ON public.referral_completions
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Staff can view venue referral completions" ON public.referral_completions
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- ============================================
-- 7. LOYALTY CHALLENGES
-- ============================================
CREATE TABLE public.loyalty_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  goal_type text NOT NULL DEFAULT 'visit_count',
  goal_value integer NOT NULL DEFAULT 3,
  reward_name text NOT NULL,
  reward_description text,
  reward_stamps integer DEFAULT 0,
  reward_points integer DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges" ON public.loyalty_challenges
  FOR SELECT USING (true);

CREATE POLICY "Venue admins can manage challenges" ON public.loyalty_challenges
  FOR ALL TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()));

-- ============================================
-- 8. PATRON CHALLENGE PROGRESS
-- ============================================
CREATE TABLE public.patron_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.loyalty_challenges(id) ON DELETE CASCADE,
  current_progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE public.patron_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge progress" ON public.patron_challenge_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Staff can view venue challenge progress" ON public.patron_challenge_progress
  FOR SELECT TO authenticated
  USING (challenge_id IN (SELECT id FROM loyalty_challenges WHERE venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid())) OR is_super_admin(auth.uid()));

-- ============================================
-- VENUE REFERRAL CONFIG (stored in loyalty_programs or separate)
-- ============================================
CREATE TABLE public.venue_referral_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  referrer_reward_type text NOT NULL DEFAULT 'stamps',
  referrer_reward_value integer NOT NULL DEFAULT 2,
  referee_reward_type text NOT NULL DEFAULT 'stamps',
  referee_reward_value integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venue_referral_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active referral config" ON public.venue_referral_config
  FOR SELECT USING (true);

CREATE POLICY "Venue admins can manage referral config" ON public.venue_referral_config
  FOR ALL TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()));
