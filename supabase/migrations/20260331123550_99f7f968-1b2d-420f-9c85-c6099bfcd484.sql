
-- Add fixed_amount column to venue_cashback_config
ALTER TABLE public.venue_cashback_config 
ADD COLUMN IF NOT EXISTS fixed_amount numeric NOT NULL DEFAULT 5;

-- Update the trigger to use fixed_amount instead of percentage calculation
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
    
    IF v_program IS NOT NULL THEN
      IF 'order' = ANY(v_program.earning_sources) THEN
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
      END IF;
    END IF;

    -- CASHBACK CREDITING (fixed amount per order)
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

    -- CHALLENGE PROGRESS (order_count type)
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
  END IF;
  RETURN NEW;
END;
$function$;
