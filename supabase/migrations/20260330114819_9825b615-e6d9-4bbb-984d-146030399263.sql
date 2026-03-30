
-- Re-attach all triggers that were lost

-- 1. Loyalty triggers
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

-- 2. Notification triggers
DROP TRIGGER IF EXISTS trg_notify_waitlist_ready ON public.waitlist_entries;
CREATE TRIGGER trg_notify_waitlist_ready
  AFTER UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_ready();

DROP TRIGGER IF EXISTS trg_notify_order_ready ON public.orders;
CREATE TRIGGER trg_notify_order_ready
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_ready();

-- 3. Analytics triggers
DROP TRIGGER IF EXISTS trg_track_order_analytics ON public.orders;
CREATE TRIGGER trg_track_order_analytics
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_order_analytics();

DROP TRIGGER IF EXISTS trg_track_waitlist_analytics ON public.waitlist_entries;
CREATE TRIGGER trg_track_waitlist_analytics
  AFTER INSERT OR UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.track_waitlist_analytics();

-- 4. Customer analytics triggers
DROP TRIGGER IF EXISTS trg_update_customer_analytics_on_order ON public.orders;
CREATE TRIGGER trg_update_customer_analytics_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_analytics_on_order();

DROP TRIGGER IF EXISTS trg_update_customer_analytics_on_waitlist ON public.waitlist_entries;
CREATE TRIGGER trg_update_customer_analytics_on_waitlist
  AFTER UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_analytics_on_waitlist();

-- 5. Waitlist position trigger
DROP TRIGGER IF EXISTS trg_update_waitlist_positions ON public.waitlist_entries;
CREATE TRIGGER trg_update_waitlist_positions
  AFTER INSERT OR UPDATE OR DELETE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_waitlist_positions();

-- 6. Backfill: generate missing reward codes for patrons who reached threshold
DO $$
DECLARE
  rec RECORD;
  v_reward RECORD;
  v_code TEXT;
BEGIN
  FOR rec IN
    SELECT pl.user_id, pl.venue_id, pl.stamps_count, lp.stamp_threshold, lp.id as program_id, lp.type
    FROM public.patron_loyalty pl
    JOIN public.loyalty_programs lp ON lp.id = pl.program_id
    WHERE lp.type = 'stamp_card'
      AND pl.stamps_count >= lp.stamp_threshold
      AND NOT EXISTS (
        SELECT 1 FROM public.discount_codes dc
        WHERE dc.user_id = pl.user_id AND dc.venue_id = pl.venue_id AND dc.status = 'active'
      )
  LOOP
    SELECT * INTO v_reward FROM public.loyalty_rewards
    WHERE program_id = rec.program_id AND is_active = true
    ORDER BY stamps_required ASC NULLS LAST LIMIT 1;

    IF v_reward IS NOT NULL THEN
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name)
      VALUES (rec.venue_id, rec.user_id, v_code, v_reward.id, v_reward.name);

      UPDATE public.patron_loyalty SET stamps_count = 0, updated_at = now()
      WHERE user_id = rec.user_id AND venue_id = rec.venue_id;
    END IF;
  END LOOP;
END $$;
