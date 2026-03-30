
-- =============================================
-- LOYALTY SYSTEM TABLES
-- =============================================

-- Loyalty Programs (one per venue)
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'stamp_card' CHECK (type IN ('stamp_card', 'points')),
  stamp_threshold INTEGER DEFAULT 10,
  points_per_visit INTEGER DEFAULT 10,
  points_per_order INTEGER DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venue_id)
);

-- Loyalty Rewards
CREATE TABLE public.loyalty_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stamps_required INTEGER,
  points_required INTEGER,
  reward_type TEXT NOT NULL DEFAULT 'discount_code' CHECK (reward_type IN ('discount_code', 'free_item', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patron Loyalty (per user per venue)
CREATE TABLE public.patron_loyalty (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  stamps_count INTEGER NOT NULL DEFAULT 0,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_stamps INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

-- Loyalty Transactions
CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('stamp_earned', 'points_earned', 'reward_redeemed', 'stamps_reset')),
  stamps_delta INTEGER DEFAULT 0,
  points_delta INTEGER DEFAULT 0,
  source_type TEXT CHECK (source_type IN ('order', 'waitlist', 'manual', 'reward')),
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Discount Codes
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  reward_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
  redeemed_at TIMESTAMPTZ,
  redeemed_by_staff_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- PROMO CAMPAIGNS TABLES
-- =============================================

CREATE TABLE public.promo_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  banner_image_url TEXT,
  cta_text TEXT DEFAULT 'Learn More',
  cta_link TEXT,
  placements TEXT[] NOT NULL DEFAULT '{home}',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'comp')),
  amount_charged NUMERIC DEFAULT 0,
  payment_notes TEXT,
  impressions_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.promo_impressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  user_id UUID,
  placement TEXT NOT NULL,
  clicked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patron_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_impressions ENABLE ROW LEVEL SECURITY;

-- loyalty_programs: anyone can view, venue admins + super admins can manage
CREATE POLICY "Anyone can view active loyalty programs" ON public.loyalty_programs FOR SELECT USING (true);
CREATE POLICY "Venue admins can manage loyalty programs" ON public.loyalty_programs FOR ALL TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()));

-- loyalty_rewards: anyone can view, venue admins can manage
CREATE POLICY "Anyone can view active loyalty rewards" ON public.loyalty_rewards FOR SELECT USING (true);
CREATE POLICY "Venue admins can manage loyalty rewards" ON public.loyalty_rewards FOR ALL TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR is_super_admin(auth.uid()));

-- patron_loyalty: users see own, venue staff see their venue's
CREATE POLICY "Users can view own loyalty" ON public.patron_loyalty FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff can view venue loyalty" ON public.patron_loyalty FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- loyalty_transactions: users see own, staff see venue
CREATE POLICY "Users can view own transactions" ON public.loyalty_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff can view venue transactions" ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- discount_codes: users see own, staff can see + update venue codes
CREATE POLICY "Users can view own codes" ON public.discount_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff can view venue codes" ON public.discount_codes FOR SELECT TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Staff can update venue codes" ON public.discount_codes FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT venue_id FROM user_roles WHERE user_id = auth.uid()) OR is_super_admin(auth.uid()));

-- promo_campaigns: authenticated can view active, super admins manage
CREATE POLICY "Anyone can view active campaigns" ON public.promo_campaigns FOR SELECT USING (is_active = true AND (end_date IS NULL OR end_date > now()));
CREATE POLICY "Super admins can manage campaigns" ON public.promo_campaigns FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- promo_impressions: insert for all authenticated, select for super admins
CREATE POLICY "Authenticated can insert impressions" ON public.promo_impressions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Super admins can view impressions" ON public.promo_impressions FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));

-- =============================================
-- TRIGGERS: Auto-credit loyalty on order collected / waitlist seated
-- =============================================

CREATE OR REPLACE FUNCTION public.credit_loyalty_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_program RECORD;
  v_loyalty RECORD;
  v_reward RECORD;
  v_code TEXT;
BEGIN
  -- Only when order moves to 'collected' and has a user_id
  IF NEW.status = 'collected' AND (OLD.status IS NULL OR OLD.status != 'collected') AND NEW.user_id IS NOT NULL THEN
    -- Find active loyalty program for this venue
    SELECT * INTO v_program FROM public.loyalty_programs
    WHERE venue_id = NEW.venue_id AND is_active = true;
    
    IF v_program IS NULL THEN RETURN NEW; END IF;
    
    -- Upsert patron_loyalty
    INSERT INTO public.patron_loyalty (user_id, venue_id, program_id, stamps_count, points_balance, lifetime_stamps, lifetime_points)
    VALUES (NEW.user_id, NEW.venue_id, v_program.id, 0, 0, 0, 0)
    ON CONFLICT (user_id, venue_id) DO NOTHING;
    
    -- Credit based on program type
    IF v_program.type = 'stamp_card' THEN
      UPDATE public.patron_loyalty
      SET stamps_count = stamps_count + 1, lifetime_stamps = lifetime_stamps + 1, updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'stamp_earned', 1, 'order', NEW.id);
      
      -- Check if threshold reached
      SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      IF v_loyalty.stamps_count >= v_program.stamp_threshold THEN
        -- Find reward
        SELECT * INTO v_reward FROM public.loyalty_rewards
        WHERE program_id = v_program.id AND is_active = true
        ORDER BY stamps_required ASC NULLS LAST LIMIT 1;
        
        IF v_reward IS NOT NULL THEN
          -- Generate unique code
          v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
          INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name)
          VALUES (NEW.venue_id, NEW.user_id, v_code, v_reward.id, v_reward.name);
          
          -- Reset stamps
          UPDATE public.patron_loyalty SET stamps_count = 0, updated_at = now()
          WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
          
          INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type)
          VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'stamps_reset', -v_loyalty.stamps_count, 'reward');
        END IF;
      END IF;
    ELSE
      -- Points mode
      UPDATE public.patron_loyalty
      SET points_balance = points_balance + v_program.points_per_order, 
          lifetime_points = lifetime_points + v_program.points_per_order, updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', v_program.points_per_order, 'order', NEW.id);
      
      -- Check points rewards
      SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      SELECT * INTO v_reward FROM public.loyalty_rewards
      WHERE program_id = v_program.id AND is_active = true AND points_required <= v_loyalty.points_balance
      ORDER BY points_required DESC LIMIT 1;
      
      IF v_reward IS NOT NULL THEN
        v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name)
        VALUES (NEW.venue_id, NEW.user_id, v_code, v_reward.id, v_reward.name);
        
        UPDATE public.patron_loyalty SET points_balance = points_balance - v_reward.points_required, updated_at = now()
        WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
        
        INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type)
        VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'reward_redeemed', -v_reward.points_required, 'reward');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_credit_loyalty_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_loyalty_on_order();

-- Same for waitlist seated
CREATE OR REPLACE FUNCTION public.credit_loyalty_on_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_program RECORD;
  v_loyalty RECORD;
  v_reward RECORD;
  v_code TEXT;
BEGIN
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') AND NEW.user_id IS NOT NULL THEN
    SELECT * INTO v_program FROM public.loyalty_programs
    WHERE venue_id = NEW.venue_id AND is_active = true;
    
    IF v_program IS NULL THEN RETURN NEW; END IF;
    
    INSERT INTO public.patron_loyalty (user_id, venue_id, program_id, stamps_count, points_balance, lifetime_stamps, lifetime_points)
    VALUES (NEW.user_id, NEW.venue_id, v_program.id, 0, 0, 0, 0)
    ON CONFLICT (user_id, venue_id) DO NOTHING;
    
    IF v_program.type = 'stamp_card' THEN
      UPDATE public.patron_loyalty
      SET stamps_count = stamps_count + 1, lifetime_stamps = lifetime_stamps + 1, updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'stamp_earned', 1, 'waitlist', NEW.id);
      
      SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      IF v_loyalty.stamps_count >= v_program.stamp_threshold THEN
        SELECT * INTO v_reward FROM public.loyalty_rewards
        WHERE program_id = v_program.id AND is_active = true
        ORDER BY stamps_required ASC NULLS LAST LIMIT 1;
        
        IF v_reward IS NOT NULL THEN
          v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
          INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name)
          VALUES (NEW.venue_id, NEW.user_id, v_code, v_reward.id, v_reward.name);
          
          UPDATE public.patron_loyalty SET stamps_count = 0, updated_at = now()
          WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
          
          INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type)
          VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'stamps_reset', -v_loyalty.stamps_count, 'reward');
        END IF;
      END IF;
    ELSE
      UPDATE public.patron_loyalty
      SET points_balance = points_balance + v_program.points_per_visit,
          lifetime_points = lifetime_points + v_program.points_per_visit, updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', v_program.points_per_visit, 'waitlist', NEW.id);
      
      SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      SELECT * INTO v_reward FROM public.loyalty_rewards
      WHERE program_id = v_program.id AND is_active = true AND points_required <= v_loyalty.points_balance
      ORDER BY points_required DESC LIMIT 1;
      
      IF v_reward IS NOT NULL THEN
        v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name)
        VALUES (NEW.venue_id, NEW.user_id, v_code, v_reward.id, v_reward.name);
        
        UPDATE public.patron_loyalty SET points_balance = points_balance - v_reward.points_required, updated_at = now()
        WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
        
        INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type)
        VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'reward_redeemed', -v_reward.points_required, 'reward');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_credit_loyalty_on_waitlist
  AFTER UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.credit_loyalty_on_waitlist();

-- Updated_at triggers
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loyalty_rewards_updated_at BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_promo_campaigns_updated_at BEFORE UPDATE ON public.promo_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
