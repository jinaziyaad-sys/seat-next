

# Move Loyalty Cards to Home Page + Improve Redemption UX

## Problem
1. Loyalty cards are buried in the Profile section — patrons rarely see them
2. When a patron has an active reward code, it's not obvious how to redeem it (just says "Show to staff" but no clear instructions)

## Plan

### 1. Add loyalty cards to the home page
Place `PatronLoyaltyCard` on the home tab, right after the promo banner and before active tracking. Use `compact` mode so it's sleek and doesn't overwhelm.

**File**: `src/pages/Index.tsx`
- Import `PatronLoyaltyCard`
- Add `<PatronLoyaltyCard compact />` between the PromoBanner section and the Active Tracking section (around line 694)
- Only render when user is logged in

### 2. Improve redemption UX in PatronLoyaltyCard
When a patron has active discount codes, make them more prominent and actionable:
- Show a pulsing "Reward Ready!" indicator on the card even when collapsed
- When expanded, show clearer redemption instructions: "Show this code to staff when ordering"
- Add a copy-to-clipboard button on the code
- Keep the card in ProfileSection too (full version), but the home page gets the compact version

**File**: `src/components/PatronLoyaltyCard.tsx`
- Add a copy-code button (clipboard icon) next to each discount code
- Add a brief instruction line: "Tell the staff this code to redeem your reward"
- When a card has active codes, show a small animated dot/badge even in collapsed state

### 3. Keep loyalty in Profile too
No removal from ProfileSection — patrons get full detail there, compact summary on home.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add compact `PatronLoyaltyCard` to home tab |
| `src/components/PatronLoyaltyCard.tsx` | Add copy-code button, better redemption instructions, reward-ready indicator |

