

# Fix Loyalty System & Add Fraud Protection + Dev Controls

## Issues Identified

1. **Loyalty triggers exist but may not be firing** — the migration created the functions and `CREATE TRIGGER` statements, but Supabase shows "no triggers in the database" in the schema dump. The triggers likely need to be re-applied or verified.

2. **No fraud protection** — anyone can create a reservation/waitlist entry and cancel it repeatedly, or place fake orders. Loyalty credits should only count for legitimate completed interactions.

3. **Merchant can't control which service earns loyalty** — currently both order (collected) and waitlist (seated) earn stamps/points regardless of whether the venue uses food_ready, table_ready, or both.

4. **No dev-level loyalty control** — super admins can't activate/deactivate loyalty per venue or tie it to pricing tiers.

## Plan

### 1. Verify and fix loyalty triggers

**File**: New migration

- Re-create the triggers with `CREATE OR REPLACE` and `DROP TRIGGER IF EXISTS` to ensure they're actually attached
- Add safeguards in the trigger functions:
  - **Anti-fraud for orders**: Only credit if order was in `in_prep` or `ready` status before `collected` (prevents fake place-and-collect)
  - **Anti-fraud for waitlist**: Only credit if entry was in `ready` status before `seated` (prevents instant seat-cancel loops)
  - **Cooldown**: Don't credit if the same user already earned loyalty at this venue within the last 30 minutes (prevents rapid cancel-rejoin abuse)
  - **Cancellation check**: Skip credit if the entry has a `cancellation_reason` or `cancelled_by` set

### 2. Add loyalty earning source control to loyalty_programs

**File**: New migration

- Add column `earning_sources TEXT[] DEFAULT '{order,waitlist}'` to `loyalty_programs`
- Update trigger functions to check if the source (order vs waitlist) is in the program's `earning_sources` array before crediting
- This lets merchants choose: food orders only, table visits only, or both

### 3. Add dev-level loyalty override

**File**: New migration + DevDashboard changes

- Add columns to `loyalty_programs`: `admin_enabled BOOLEAN DEFAULT true`, `admin_notes TEXT`
- When `admin_enabled = false`, the triggers skip crediting regardless of `is_active`
- Merchant sees "Loyalty program suspended by platform" message when disabled by admin

**File**: `src/pages/DevDashboard.tsx`

- Add a loyalty toggle per venue in the venue card/edit view
- Show loyalty program status (active/inactive/suspended) as a badge

### 4. Update merchant LoyaltySettings to show earning source control

**File**: `src/components/merchant/LoyaltySettings.tsx`

- Add checkboxes for "Earn from food orders" and "Earn from table visits"
- Only show options relevant to the venue's `service_types` (e.g., if venue is food_ready only, don't show table visits option)
- Show warning if admin has suspended the program

### 5. Update patron-facing loyalty to reflect status

**File**: `src/components/PatronLoyaltyCard.tsx`

- If program is suspended (`admin_enabled = false`), show a "Program paused" badge instead of active stamps/points

## Technical Details

### Anti-fraud trigger logic (added to both credit functions)
```sql
-- For orders: verify it went through proper flow
IF OLD.status NOT IN ('ready', 'in_prep') THEN
  RETURN NEW; -- Skip: didn't go through kitchen
END IF;

-- Cooldown: no double-credit within 30 min
IF EXISTS (
  SELECT 1 FROM loyalty_transactions
  WHERE user_id = NEW.user_id AND venue_id = NEW.venue_id
    AND created_at > now() - INTERVAL '30 minutes'
    AND type IN ('stamp_earned', 'points_earned')
) THEN
  RETURN NEW;
END IF;

-- Check earning sources
IF NOT ('order' = ANY(v_program.earning_sources)) THEN
  RETURN NEW;
END IF;
```

### Earning sources column
```sql
ALTER TABLE loyalty_programs 
  ADD COLUMN earning_sources TEXT[] DEFAULT '{order,waitlist}',
  ADD COLUMN admin_enabled BOOLEAN DEFAULT true,
  ADD COLUMN admin_notes TEXT;
```

## Files Changed

| File | Change |
|------|--------|
| New migration | Re-apply triggers, add fraud checks, add `earning_sources`/`admin_enabled` columns |
| `src/components/merchant/LoyaltySettings.tsx` | Add earning source checkboxes, admin suspension warning |
| `src/components/PatronLoyaltyCard.tsx` | Show "paused" state when admin-disabled |
| `src/pages/DevDashboard.tsx` | Add loyalty toggle per venue in venue management |

