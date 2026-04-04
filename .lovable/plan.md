

# Fix: Loyalty Stamps Not Being Awarded on Order Collection

## Root Cause

The `credit_loyalty_on_order` trigger function has two anti-fraud checks that are blocking legitimate stamp awards:

1. **30-minute cooldown** (lines 18-26): If ANY `stamp_earned` transaction exists for the same user+venue within 30 minutes, the stamp is skipped. This means if a patron picks up 2 orders in a session, only the first one gets a stamp.

2. **Kitchen flow check** (lines 13-16): `OLD.status NOT IN ('ready', 'in_prep')` — if orders were bulk-collected from a different status (e.g., directly from 'placed'), no stamp is awarded.

Additionally, there are **duplicate triggers** (`trg_credit_loyalty_on_order` and `trigger_credit_loyalty_on_order`) both calling the same function, which is harmless but messy.

## Fix

**Migration to update `credit_loyalty_on_order` function:**

1. **Change cooldown to per-order instead of per-venue** — check if this specific `order_id` already earned a stamp, not a blanket 30-minute window:
   ```sql
   IF EXISTS (
     SELECT 1 FROM public.loyalty_transactions
     WHERE source_id = NEW.id AND type = 'stamp_earned'
   ) THEN RETURN NEW; END IF;
   ```

2. **Relax kitchen flow check** — allow any previous status that indicates the order was processed (not just `ready`/`in_prep`):
   ```sql
   IF OLD.status NOT IN ('ready', 'in_prep', 'placed') THEN
     RETURN NEW;
   END IF;
   ```
   Or remove it entirely since the per-order dedup already prevents double-crediting.

3. **Drop duplicate trigger** — remove `trigger_credit_loyalty_on_order` since `trg_credit_loyalty_on_order` does the same thing.

4. **Apply same fix to `credit_loyalty_on_waitlist`** — change its cooldown from time-based to per-entry dedup as well, and drop its duplicate trigger.

## Technical Details

| Change | File/Location |
|---|---|
| New migration SQL | `supabase/migrations/` (via migration tool) |

The migration replaces both `credit_loyalty_on_order` and `credit_loyalty_on_waitlist` functions with per-source-id dedup instead of time-based cooldown, and drops duplicate triggers.

No frontend changes needed — the patron's real-time subscription will pick up the new stamps automatically.

