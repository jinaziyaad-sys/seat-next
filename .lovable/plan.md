

# Fix Multi-Venue Billing Workflow

## Problem
When a user has two restaurants, the billing and plan management flows get mixed up because:

1. **`customer-portal` edge function ignores venue context**: It queries `user_roles` with `maybeSingle()` (line 51), which returns an arbitrary venue for multi-venue users. The portal then opens for the wrong venue's subscription.
2. **No venue context on billing page**: The billing page doesn't show *which* venue's billing you're managing, so it's unclear if you're looking at Restaurant A or B.
3. **Portal doesn't receive `venueId`**: The frontend calls `customer-portal` without passing the current venue ID, so the backend has no way to scope it correctly.

## Fixes

### 1. `customer-portal` edge function — Accept `venueId` parameter
- Accept `venueId` from the request body (same pattern as `check-subscription`)
- Use it to look up the correct `stripe_customer_id` from `merchant_subscriptions` for that specific venue
- Fall back to email-based lookup only if no venue-specific record exists

### 2. `MerchantBilling.tsx` — Pass `venueId` to portal + show venue name
- Pass `{ venueId: userRole.venue_id }` in the body when invoking `customer-portal`
- Display the current venue name in the billing page header so the user knows which restaurant they're managing
- Show a venue indicator (logo + name) next to "Billing & Subscription"

### 3. `MerchantDashboard.tsx` — Pass `venueId` to portal calls (if any)
- Verify all dashboard-level billing navigations include `venueId` (already done for upgrade links, but check portal invocations)

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/customer-portal/index.ts` | Accept `venueId` body param, scope customer lookup to that venue |
| `src/pages/MerchantBilling.tsx` | Pass `venueId` to portal call; show venue name in header |

