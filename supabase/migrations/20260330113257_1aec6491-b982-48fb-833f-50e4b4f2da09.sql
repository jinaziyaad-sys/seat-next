-- Add new columns to loyalty_programs
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS earning_sources TEXT[] DEFAULT '{order,waitlist}',
  ADD COLUMN IF NOT EXISTS admin_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Replace order loyalty trigger with fraud protection
CREATE OR REPLACE FUNCTION public.credit_loyalty_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program RECORD;
  v_loyalty RECORD;
  v_reward RECORD;
  v_code TEXT;
BEGIN
  IF NEW.status = 'collected' AND (OLD.status IS NULL OR OLD.status != 'collected') AND NEW.user_id IS NOT NULL THEN
    -- ANTI-FRAUD: Only credit if order went through proper kitchen flow
    IF OLD.status NOT IN ('ready', 'in_prep') THEN
      RETURN NEW;
    END IF;

    -- ANTI-FRAUD: Cooldown - no double-credit within 30 minutes at same venue
    IF EXISTS (
      SELECT 1 FROM public.loyalty_transactions
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id
        AND created_at > now() - INTERVAL '30 minutes'
        AND type IN ('stamp_earned', 'points_earned')
    ) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_program FROM public.loyalty_programs
    WHERE venue_id = NEW.venue_id AND is_active = true AND admin_enabled = true;
    
    IF v_program IS NULL THEN RETURN NEW; END IF;

    -- Check earning sources
    IF NOT ('order' = ANY(v_program.earning_sources)) THEN
      RETURN NEW;
    END IF;
    
    INSERT INTO public.patron_loyalty (user_id, venue_id, program_id, stamps_count, points_balance, lifetime_stamps, lifetime_points)
    VALUES (NEW.user_id, NEW.venue_id, v_program.id, 0, 0, 0, 0)
    ON CONFLICT (user_id, venue_id) DO NOTHING;
    
    IF v_program.type = 'stamp_card' THEN
      UPDATE public.patron_loyalty
      SET stamps_count = stamps_count + 1, lifetime_stamps = lifetime_stamps + 1, updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'stamp_earned', 1, 'order', NEW.id);
      
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
      SET points_balance = points_balance + COALESCE(v_program.points_per_order, 10), 
          lifetime_points = lifetime_points + COALESCE(v_program.points_per_order, 10), updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', COALESCE(v_program.points_per_order, 10), 'order', NEW.id);
      
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
$function$;

-- Replace waitlist loyalty trigger with fraud protection
CREATE OR REPLACE FUNCTION public.credit_loyalty_on_waitlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program RECORD;
  v_loyalty RECORD;
  v_reward RECORD;
  v_code TEXT;
BEGIN
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') AND NEW.user_id IS NOT NULL THEN
    -- ANTI-FRAUD: Only credit if entry was in 'ready' status before 'seated'
    IF OLD.status != 'ready' THEN
      RETURN NEW;
    END IF;

    -- ANTI-FRAUD: Skip if entry was cancelled
    IF NEW.cancellation_reason IS NOT NULL OR NEW.cancelled_by IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- ANTI-FRAUD: Cooldown
    IF EXISTS (
      SELECT 1 FROM public.loyalty_transactions
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id
        AND created_at > now() - INTERVAL '30 minutes'
        AND type IN ('stamp_earned', 'points_earned')
    ) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_program FROM public.loyalty_programs
    WHERE venue_id = NEW.venue_id AND is_active = true AND admin_enabled = true;
    
    IF v_program IS NULL THEN RETURN NEW; END IF;

    IF NOT ('waitlist' = ANY(v_program.earning_sources)) THEN
      RETURN NEW;
    END IF;
    
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
      SET points_balance = points_balance + COALESCE(v_program.points_per_visit, 10),
          lifetime_points = lifetime_points + COALESCE(v_program.points_per_visit, 10), updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', COALESCE(v_program.points_per_visit, 10), 'waitlist', NEW.id);
      
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
$function$;

-- Re-apply triggers
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_order ON public.orders;
CREATE TRIGGER trg_credit_loyalty_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_on_order();

DROP TRIGGER IF EXISTS trg_credit_loyalty_on_waitlist ON public.waitlist_entries;
CREATE TRIGGER trg_credit_loyalty_on_waitlist
  AFTER UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_on_waitlist();