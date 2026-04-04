
-- Harden the trigger function with exception handling
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
  v_cashback_config RECORD;
  v_cashback_amount NUMERIC;
  v_challenge RECORD;
  v_tier RECORD;
BEGIN
  IF NEW.status != 'collected' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT NULL AND OLD.status = 'collected' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  RAISE LOG 'credit_loyalty_on_order: order=% user=% venue=% old_status=%', NEW.id, NEW.user_id, NEW.venue_id, OLD.status;

  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.loyalty_transactions
      WHERE source_id = NEW.id AND type IN ('stamp_earned', 'points_earned')
    ) THEN
      RAISE LOG 'credit_loyalty_on_order: SKIPPED dedup order=%', NEW.id;
      RETURN NEW;
    END IF;

    SELECT * INTO v_program FROM public.loyalty_programs
    WHERE venue_id = NEW.venue_id AND is_active = true AND admin_enabled = true;
    
    IF v_program IS NULL THEN
      RAISE LOG 'credit_loyalty_on_order: NO PROGRAM for venue=%', NEW.venue_id;
      RETURN NEW;
    END IF;

    IF NOT ('order' = ANY(v_program.earning_sources)) THEN
      RAISE LOG 'credit_loyalty_on_order: order not in earning_sources venue=%', NEW.venue_id;
      RETURN NEW;
    END IF;

    RAISE LOG 'credit_loyalty_on_order: AWARDING stamp order=% program=%', NEW.id, v_program.id;

    INSERT INTO public.patron_loyalty (user_id, venue_id, program_id, stamps_count, points_balance, lifetime_stamps, lifetime_points)
    VALUES (NEW.user_id, NEW.venue_id, v_program.id, 0, 0, 0, 0)
    ON CONFLICT (user_id, venue_id) DO NOTHING;
    
    IF v_program.type = 'stamp_card' THEN
      UPDATE public.patron_loyalty
      SET stamps_count = stamps_count + 1, lifetime_stamps = lifetime_stamps + 1, updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'stamp_earned', 1, 'order', NEW.id);

      RAISE LOG 'credit_loyalty_on_order: STAMP INSERTED order=%', NEW.id;
      
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
          
          RAISE LOG 'credit_loyalty_on_order: AUTO-REDEEMED reward=% code=%', v_reward.name, v_code;
        END IF;
      END IF;
    ELSE
      UPDATE public.patron_loyalty
      SET points_balance = points_balance + COALESCE(v_program.points_per_order, 10), 
          lifetime_points = lifetime_points + COALESCE(v_program.points_per_order, 10), updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
      
      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', COALESCE(v_program.points_per_order, 10), 'order', NEW.id);
    END IF;

    -- TIER RECALCULATION
    SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
    IF v_loyalty IS NOT NULL THEN
      SELECT * INTO v_tier FROM public.loyalty_tiers
      WHERE venue_id = NEW.venue_id AND is_active = true
        AND (min_lifetime_stamps <= v_loyalty.lifetime_stamps OR min_lifetime_points <= v_loyalty.lifetime_points)
      ORDER BY sort_order DESC LIMIT 1;
      
      IF v_tier IS NOT NULL THEN
        INSERT INTO public.patron_tier_status (user_id, venue_id, current_tier_id)
        VALUES (NEW.user_id, NEW.venue_id, v_tier.id)
        ON CONFLICT (user_id, venue_id) DO UPDATE SET current_tier_id = v_tier.id, updated_at = now();
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_order ERROR: % (SQLSTATE: %) order=%', SQLERRM, SQLSTATE, NEW.id;
  END;

  -- CASHBACK (separate error block)
  BEGIN
    SELECT * INTO v_cashback_config FROM public.venue_cashback_config
    WHERE venue_id = NEW.venue_id AND is_active = true;
    
    IF v_cashback_config IS NOT NULL THEN
      v_cashback_amount := COALESCE(v_cashback_config.fixed_amount, 5);
      IF v_cashback_amount > 0 THEN
        INSERT INTO public.patron_cashback_balance (user_id, venue_id, balance, lifetime_earned)
        VALUES (NEW.user_id, NEW.venue_id, v_cashback_amount, v_cashback_amount)
        ON CONFLICT (user_id, venue_id) DO UPDATE SET
          balance = patron_cashback_balance.balance + v_cashback_amount,
          lifetime_earned = patron_cashback_balance.lifetime_earned + v_cashback_amount,
          updated_at = now();
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_order CASHBACK ERROR: % order=%', SQLERRM, NEW.id;
  END;

  -- CHALLENGES (separate error block)
  BEGIN
    FOR v_challenge IN
      SELECT * FROM public.loyalty_challenges
      WHERE venue_id = NEW.venue_id AND is_active = true AND goal_type = 'order_count'
        AND start_date <= now() AND (end_date IS NULL OR end_date > now())
    LOOP
      INSERT INTO public.patron_challenge_progress (user_id, challenge_id, current_progress)
      VALUES (NEW.user_id, v_challenge.id, 1)
      ON CONFLICT (user_id, challenge_id) DO UPDATE SET
        current_progress = patron_challenge_progress.current_progress + 1,
        completed = CASE WHEN patron_challenge_progress.current_progress + 1 >= v_challenge.goal_value THEN true ELSE patron_challenge_progress.completed END,
        completed_at = CASE WHEN patron_challenge_progress.current_progress + 1 >= v_challenge.goal_value AND NOT patron_challenge_progress.completed THEN now() ELSE patron_challenge_progress.completed_at END,
        updated_at = now();
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_order CHALLENGE ERROR: % order=%', SQLERRM, NEW.id;
  END;

  RETURN NEW;
END;
$function$;

-- Harden waitlist trigger too
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
  v_challenge RECORD;
  v_tier RECORD;
BEGIN
  IF NEW.status != 'seated' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT NULL AND OLD.status = 'seated' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.cancellation_reason IS NOT NULL OR NEW.cancelled_by IS NOT NULL THEN RETURN NEW; END IF;

  RAISE LOG 'credit_loyalty_on_waitlist: entry=% user=% venue=%', NEW.id, NEW.user_id, NEW.venue_id;

  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.loyalty_transactions
      WHERE source_id = NEW.id AND type IN ('stamp_earned', 'points_earned')
    ) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_program FROM public.loyalty_programs
    WHERE venue_id = NEW.venue_id AND is_active = true AND admin_enabled = true;
    
    IF v_program IS NULL OR NOT ('waitlist' = ANY(v_program.earning_sources)) THEN
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
    END IF;

    -- TIER RECALCULATION
    SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
    IF v_loyalty IS NOT NULL THEN
      SELECT * INTO v_tier FROM public.loyalty_tiers
      WHERE venue_id = NEW.venue_id AND is_active = true
        AND (min_lifetime_stamps <= v_loyalty.lifetime_stamps OR min_lifetime_points <= v_loyalty.lifetime_points)
      ORDER BY sort_order DESC LIMIT 1;
      
      IF v_tier IS NOT NULL THEN
        INSERT INTO public.patron_tier_status (user_id, venue_id, current_tier_id)
        VALUES (NEW.user_id, NEW.venue_id, v_tier.id)
        ON CONFLICT (user_id, venue_id) DO UPDATE SET current_tier_id = v_tier.id, updated_at = now();
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_waitlist ERROR: % (SQLSTATE: %) entry=%', SQLERRM, SQLSTATE, NEW.id;
  END;

  -- CHALLENGES
  BEGIN
    FOR v_challenge IN
      SELECT * FROM public.loyalty_challenges
      WHERE venue_id = NEW.venue_id AND is_active = true AND goal_type = 'visit_count'
        AND start_date <= now() AND (end_date IS NULL OR end_date > now())
    LOOP
      INSERT INTO public.patron_challenge_progress (user_id, challenge_id, current_progress)
      VALUES (NEW.user_id, v_challenge.id, 1)
      ON CONFLICT (user_id, challenge_id) DO UPDATE SET
        current_progress = patron_challenge_progress.current_progress + 1,
        completed = CASE WHEN patron_challenge_progress.current_progress + 1 >= v_challenge.goal_value THEN true ELSE patron_challenge_progress.completed END,
        completed_at = CASE WHEN patron_challenge_progress.current_progress + 1 >= v_challenge.goal_value AND NOT patron_challenge_progress.completed THEN now() ELSE patron_challenge_progress.completed_at END,
        updated_at = now();
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_waitlist CHALLENGE ERROR: % entry=%', SQLERRM, NEW.id;
  END;

  RETURN NEW;
END;
$function$;

-- Normalize stamps_count: with 120 stamps and threshold 3, that's 40 full cards
-- Reset to modulo and just keep 1 test stamp for a clean start
UPDATE public.patron_loyalty 
SET stamps_count = 1, lifetime_stamps = 124, updated_at = now()
WHERE venue_id = '119335f3-6c25-4786-a02c-6df427b12d30' 
  AND user_id = '3a4ce0a9-01d4-45c7-8183-dd8fe7b6c5c5';
