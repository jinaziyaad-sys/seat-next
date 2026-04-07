

# Fix: Subscription Upgrade Discovery & La-tayy Cleanup

## Root Cause Analysis

### Problem 1: `check-subscription` never discovers upgrades
Lines 287-330: When a stored subscription ID exists and is **still active** in Stripe, it returns immediately with that subscription's data. It only searches for newer subs when the stored sub is **cancelled** (line 341). Since the old Pro sub was never cancelled, the recovery path never triggers.

### Problem 2: `create-checkout` metadata mismatch
Lines 62-63: The cancellation logic checks `sub.metadata?.venue_id === venueId`, but this is **subscription-level** metadata. The venue_id is set in `subscription_data.metadata` (line 157), which attaches to the subscription object. However, older subscriptions created before this code was added may not have `venue_id` in their metadata, causing them to be skipped.

### Problem 3: La-tayy has an uncancelled Pro sub
`sub_1TJGJJRrnmiHUS0Lkgw2BZV3` (Pro) is still active in Stripe. The newer Enterprise sub `sub_1TJIT0RrnmiHUS0LYInUwdQa` exists but is unclaimed.

## Fix Plan

### 1. `check-subscription/index.ts` — Check for newer subs even when stored sub is active (lines 287-330)

After retrieving and confirming the stored sub is active, add a check: query the customer's other active subs to see if any has a **different (newer) product** for the same venue. If found, cancel the old one and switch to the new one. This handles the upgrade case where `create-checkout` failed to cancel the old sub.

```text
Current flow (lines 287-330):
  retrieve stored sub → if active → return it ← PROBLEM: stops here

New flow:
  retrieve stored sub → if active →
    list ALL customer active subs →
    find any with venue_id matching AND created after stored sub →
    if found: cancel old sub, sync new one, return new
    else: return stored sub as before
```

### 2. `create-checkout/index.ts` — Also cancel by DB lookup (lines 51-68)

Add a fallback: before the metadata-based search, query `merchant_subscriptions` for the venue's current `stripe_subscription_id` and cancel that directly. This handles old subs that lack venue_id metadata.

### 3. Cancel La-tayy's old Pro sub via Stripe tool
Cancel `sub_1TJGJJRrnmiHUS0Lkgw2BZV3`. The next `check-subscription` call will then find the Enterprise sub and sync it.

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/check-subscription/index.ts` | Add upgrade discovery when stored sub is active (lines 292-330) |
| `supabase/functions/create-checkout/index.ts` | Add DB-based cancellation fallback before metadata search |
| Stripe (manual) | Cancel `sub_1TJGJJRrnmiHUS0Lkgw2BZV3` |

