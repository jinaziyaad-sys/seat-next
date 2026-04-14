

## Problem

Line 398 in `src/pages/MerchantDashboard.tsx`:
```typescript
const hasPromotions = subscription.hasFeature('analytics'); // Pro+ can create promotions
```

Promotions are gated behind the `analytics` feature flag, meaning only Pro and Enterprise merchants see the Promotions tab. Starter merchants can't create or manage promotional campaigns at all.

## Fix

Remove the feature gate — make promotions available to all subscribed merchants.

### File: `src/pages/MerchantDashboard.tsx`

**Line 398**: Change `hasPromotions` to always be `true` for subscribed merchants (no feature check needed).

```typescript
const hasPromotions = true; // Promotions available to all plans
```

**Lines 659 and 767**: The existing `{hasPromotions && ...}` conditionals will now always render, so no other changes needed.

One line change, promotions tab appears for everyone.

