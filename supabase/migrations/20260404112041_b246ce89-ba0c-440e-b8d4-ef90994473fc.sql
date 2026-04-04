
-- First, recreate the trigger functions since the first migration failed
-- Check if we need to recreate them
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_order ON public.orders;
DROP TRIGGER IF EXISTS trigger_credit_loyalty_on_order ON public.orders;
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_waitlist ON public.waitlist_entries;
DROP TRIGGER IF EXISTS trigger_credit_loyalty_on_waitlist ON public.waitlist_entries;

CREATE TRIGGER trg_credit_loyalty_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_on_order();

CREATE TRIGGER trg_credit_loyalty_on_waitlist
  AFTER UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_on_waitlist();

-- Direct reconciliation: insert stamp transactions for all missed orders
INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type, source_id)
SELECT o.user_id, o.venue_id, lp.id, 'stamp_earned', 1, 'order', o.id
FROM public.orders o
JOIN public.loyalty_programs lp ON lp.venue_id = o.venue_id AND lp.is_active = true AND lp.admin_enabled = true AND lp.type = 'stamp_card'
WHERE o.status = 'collected'
  AND o.user_id IS NOT NULL
  AND 'order' = ANY(lp.earning_sources)
  AND NOT EXISTS (
    SELECT 1 FROM public.loyalty_transactions lt WHERE lt.source_id = o.id AND lt.type IN ('stamp_earned', 'points_earned')
  );

-- Now update the patron_loyalty stamps_count based on actual unredeemed stamps
-- First count stamps since last reset for each user/venue
UPDATE public.patron_loyalty pl
SET 
  stamps_count = sub.current_stamps,
  lifetime_stamps = sub.total_earned,
  updated_at = now()
FROM (
  SELECT 
    lt.user_id,
    lt.venue_id,
    SUM(lt.stamps_delta) as total_earned,
    -- Count stamps since last reset
    COALESCE((
      SELECT SUM(lt2.stamps_delta)
      FROM public.loyalty_transactions lt2
      WHERE lt2.user_id = lt.user_id 
        AND lt2.venue_id = lt.venue_id
        AND lt2.created_at > COALESCE(
          (SELECT MAX(lt3.created_at) FROM public.loyalty_transactions lt3 
           WHERE lt3.user_id = lt.user_id AND lt3.venue_id = lt.venue_id AND lt3.type = 'stamps_reset'),
          '1970-01-01'
        )
        AND lt2.type IN ('stamp_earned')
    ), 0) as current_stamps
  FROM public.loyalty_transactions lt
  WHERE lt.type IN ('stamp_earned')
  GROUP BY lt.user_id, lt.venue_id
) sub
WHERE pl.user_id = sub.user_id AND pl.venue_id = sub.venue_id;
