CREATE OR REPLACE FUNCTION public.process_stamp_card_redemption(
  p_user_id uuid,
  p_venue_id uuid,
  p_program_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loyalty RECORD;
  v_program RECORD;
  v_reward RECORD;
  v_threshold integer;
  v_vouchers_to_issue integer;
  v_remainder integer;
  v_code text;
  v_expires_at timestamptz;
  i integer;
BEGIN
  SELECT * INTO v_loyalty
  FROM public.patron_loyalty
  WHERE user_id = p_user_id AND venue_id = p_venue_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_program
  FROM public.loyalty_programs
  WHERE id = p_program_id;

  IF NOT FOUND OR v_program.type <> 'stamp_card' OR v_program.is_active IS DISTINCT FROM true OR v_program.admin_enabled IS DISTINCT FROM true THEN
    RETURN;
  END IF;

  v_threshold := COALESCE(v_program.stamp_threshold, 10);

  IF v_threshold <= 0 OR v_loyalty.stamps_count < v_threshold THEN
    RETURN;
  END IF;

  SELECT * INTO v_reward
  FROM public.loyalty_rewards
  WHERE program_id = p_program_id
    AND is_active = true
  ORDER BY COALESCE(stamps_required, v_threshold) ASC, created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE LOG 'process_stamp_card_redemption: NO REWARD user=% venue=% program=%', p_user_id, p_venue_id, p_program_id;
    RETURN;
  END IF;

  v_vouchers_to_issue := FLOOR(v_loyalty.stamps_count::numeric / v_threshold)::integer;
  v_remainder := MOD(v_loyalty.stamps_count, v_threshold);

  IF v_vouchers_to_issue <= 0 THEN
    RETURN;
  END IF;

  FOR i IN 1..v_vouchers_to_issue LOOP
    LOOP
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_user_id::text || p_venue_id::text || i::text), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.discount_codes
        WHERE code = v_code
      );
    END LOOP;

    v_expires_at := now() + (COALESCE(v_reward.voucher_validity_days, 30) || ' days')::interval;

    INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name, expires_at, status)
    VALUES (p_venue_id, p_user_id, v_code, v_reward.id, v_reward.name, v_expires_at, 'active');

    INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type)
    VALUES (p_user_id, p_venue_id, p_program_id, 'stamps_reset', -v_threshold, 'reward');
  END LOOP;

  UPDATE public.patron_loyalty
  SET stamps_count = v_remainder,
      updated_at = now()
  WHERE user_id = p_user_id AND venue_id = p_venue_id;

  RAISE LOG 'process_stamp_card_redemption: ISSUED % voucher(s), remainder=% user=% venue=% program=%', v_vouchers_to_issue, v_remainder, p_user_id, p_venue_id, p_program_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.credit_loyalty_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program RECORD;
  v_loyalty RECORD;
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

    IF NOT FOUND THEN
      RAISE LOG 'credit_loyalty_on_order: NO PROGRAM for venue=%', NEW.venue_id;
      RETURN NEW;
    END IF;

    IF NOT ('order' = ANY(v_program.earning_sources)) THEN
      RAISE LOG 'credit_loyalty_on_order: order not in earning_sources venue=%', NEW.venue_id;
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

      PERFORM public.process_stamp_card_redemption(NEW.user_id, NEW.venue_id, v_program.id);
    ELSE
      UPDATE public.patron_loyalty
      SET points_balance = points_balance + COALESCE(v_program.points_per_order, 10),
          lifetime_points = lifetime_points + COALESCE(v_program.points_per_order, 10), updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;

      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', COALESCE(v_program.points_per_order, 10), 'order', NEW.id);
    END IF;

    SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
    IF FOUND THEN
      SELECT * INTO v_tier FROM public.loyalty_tiers
      WHERE venue_id = NEW.venue_id AND is_active = true
        AND (min_lifetime_stamps <= v_loyalty.lifetime_stamps OR min_lifetime_points <= v_loyalty.lifetime_points)
      ORDER BY sort_order DESC LIMIT 1;

      IF FOUND THEN
        INSERT INTO public.patron_tier_status (user_id, venue_id, current_tier_id)
        VALUES (NEW.user_id, NEW.venue_id, v_tier.id)
        ON CONFLICT (user_id, venue_id) DO UPDATE SET current_tier_id = v_tier.id, updated_at = now();
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_order ERROR: % (SQLSTATE: %) order=%', SQLERRM, SQLSTATE, NEW.id;
  END;

  BEGIN
    SELECT * INTO v_cashback_config FROM public.venue_cashback_config
    WHERE venue_id = NEW.venue_id AND is_active = true;

    IF FOUND THEN
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

CREATE OR REPLACE FUNCTION public.credit_loyalty_on_waitlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program RECORD;
  v_loyalty RECORD;
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

    IF NOT FOUND OR NOT ('waitlist' = ANY(v_program.earning_sources)) THEN
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

      PERFORM public.process_stamp_card_redemption(NEW.user_id, NEW.venue_id, v_program.id);
    ELSE
      UPDATE public.patron_loyalty
      SET points_balance = points_balance + COALESCE(v_program.points_per_visit, 10),
          lifetime_points = lifetime_points + COALESCE(v_program.points_per_visit, 10), updated_at = now()
      WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;

      INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, points_delta, source_type, source_id)
      VALUES (NEW.user_id, NEW.venue_id, v_program.id, 'points_earned', COALESCE(v_program.points_per_visit, 10), 'waitlist', NEW.id);
    END IF;

    SELECT * INTO v_loyalty FROM public.patron_loyalty WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id;
    IF FOUND THEN
      SELECT * INTO v_tier FROM public.loyalty_tiers
      WHERE venue_id = NEW.venue_id AND is_active = true
        AND (min_lifetime_stamps <= v_loyalty.lifetime_stamps OR min_lifetime_points <= v_loyalty.lifetime_points)
      ORDER BY sort_order DESC LIMIT 1;

      IF FOUND THEN
        INSERT INTO public.patron_tier_status (user_id, venue_id, current_tier_id)
        VALUES (NEW.user_id, NEW.venue_id, v_tier.id)
        ON CONFLICT (user_id, venue_id) DO UPDATE SET current_tier_id = v_tier.id, updated_at = now();
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'credit_loyalty_on_waitlist ERROR: % (SQLSTATE: %) entry=%', SQLERRM, SQLSTATE, NEW.id;
  END;

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

DO $do$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT pl.user_id, pl.venue_id, pl.program_id
    FROM public.patron_loyalty pl
    JOIN public.loyalty_programs lp ON lp.id = pl.program_id
    WHERE lp.type = 'stamp_card'
      AND COALESCE(lp.stamp_threshold, 10) > 0
      AND pl.stamps_count >= COALESCE(lp.stamp_threshold, 10)
  LOOP
    PERFORM public.process_stamp_card_redemption(v_row.user_id, v_row.venue_id, v_row.program_id);
  END LOOP;
END;
$do$;