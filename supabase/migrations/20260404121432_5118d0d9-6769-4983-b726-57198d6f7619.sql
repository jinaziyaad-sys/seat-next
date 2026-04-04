-- Ensure the trigger on orders exists
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_order ON public.orders;
CREATE TRIGGER trg_credit_loyalty_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_on_order();

-- Ensure the trigger on waitlist_entries exists
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_waitlist ON public.waitlist_entries;
CREATE TRIGGER trg_credit_loyalty_on_waitlist
  AFTER UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_on_waitlist();

-- Reconcile: auto-redeem for any patron currently at or above threshold
DO $$
DECLARE
  rec RECORD;
  v_reward RECORD;
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  FOR rec IN
    SELECT pl.user_id, pl.venue_id, pl.stamps_count, pl.program_id, lp.stamp_threshold
    FROM public.patron_loyalty pl
    JOIN public.loyalty_programs lp ON lp.id = pl.program_id
    WHERE pl.stamps_count >= lp.stamp_threshold
      AND lp.is_active = true
      AND lp.type = 'stamp_card'
  LOOP
    SELECT * INTO v_reward FROM public.loyalty_rewards
    WHERE program_id = rec.program_id AND is_active = true
    ORDER BY stamps_required ASC NULLS LAST LIMIT 1;

    IF v_reward IS NOT NULL THEN
      WHILE rec.stamps_count >= rec.stamp_threshold LOOP
        v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        v_expires_at := now() + (COALESCE(v_reward.voucher_validity_days, 30) || ' days')::interval;

        INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name, expires_at, status)
        VALUES (rec.venue_id, rec.user_id, v_code, v_reward.id, v_reward.name, v_expires_at, 'active');

        INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type)
        VALUES (rec.user_id, rec.venue_id, rec.program_id, 'stamps_reset', -rec.stamp_threshold, 'reward');

        rec.stamps_count := rec.stamps_count - rec.stamp_threshold;
      END LOOP;

      UPDATE public.patron_loyalty
      SET stamps_count = rec.stamps_count, updated_at = now()
      WHERE user_id = rec.user_id AND venue_id = rec.venue_id;
    END IF;
  END LOOP;
END;
$$;