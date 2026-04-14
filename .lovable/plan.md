

## Clean Slate for Billing + Fix Loading Speed

### Current State
- **Stripe**: All 11 subscriptions are already **canceled** — no active subs exist
- **Database**: Two stale rows remain in `merchant_subscriptions`:
  - `ziis place` → status `active`, pointing to canceled `sub_1TM60iRrnmiHUS0LiMA7Vu3B`
  - `La-tayy` → status `trial`, pointing to canceled `sub_1TLnD7RrnmiHUS0Ly6IVhUuc`
- **Root cause of slow loading**: The DB says `active`/`trial`, so the DB-first path returns immediately — but the data is stale (pointing to canceled subs). On `forceRefresh`, it hits Stripe, finds the sub canceled, then scans ALL customers/subs (expensive). But because the code "preserves DB state" when Stripe finds nothing active, it never corrects the stale row. This creates a loop of stale-but-preserved state.

### Plan

#### 1. Clear stale subscription data (DB migration)
Delete both rows from `merchant_subscriptions` so both venues start fresh with `status: none`.

#### 2. Fix the "preserving stale state" bug in `check-subscription`
Line 281-288: When Stripe reconciliation finds NO active subscription but the DB says `active`/`trial`, the current code **preserves** the stale DB state. This is wrong — if we explicitly did a Stripe scan and found nothing, we should update the DB to `inactive`. The "non-destructive" protection should only apply when Stripe API fails (errors), not when the scan succeeds but finds nothing.

Change: After a successful Stripe scan that finds no active sub, update the DB row to `status: inactive` instead of preserving stale `active` state.

#### 3. Fix loading delay on dashboard
The billing page waits for `useMerchantSubscription` which calls `check-subscription`. When there's no subscription, the first call goes DB-first (returns stale active), then `forceRefresh` triggers, scans Stripe, finds nothing, but preserves stale state — creating an infinite loop of incorrect state. After fix #2, the first `forceRefresh` will correct the DB, and subsequent loads will be fast (DB returns `inactive` immediately).

### Files to Change
| File | Change |
|------|--------|
| New migration | `DELETE FROM merchant_subscriptions` |
| `supabase/functions/check-subscription/index.ts` | Lines 279-290: When Stripe scan succeeds but finds nothing, update DB to `inactive` instead of preserving stale `active` state |

### After Implementation
Both venues will show "No Subscription". You can then go through the signup flow fresh to test the full billing lifecycle end-to-end.
