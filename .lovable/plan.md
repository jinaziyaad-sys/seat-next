

## Problem

When a merchant with multiple venues has no active subscription, they hit a paywall screen that says "Subscribe to Get Started" with a button linking to `/merchant/signup?upgrade=true&venueId={currentVenueId}`. But this paywall doesn't show which venue they're purchasing for, and there's no way to switch venues from this screen — the VenueSwitcher only renders inside the main dashboard (which is behind the paywall).

## Fix

### 1. Show venue name on the paywall screen
Display the current venue name prominently on the paywall so the merchant knows which venue they're subscribing for.

### 2. Add venue switcher to the paywall
If the user has multiple venues (`allVenueRoles.length > 1`), show a compact venue switcher on the paywall screen so they can pick which venue to subscribe for before clicking "View Plans & Subscribe".

### File changes
- **`src/pages/MerchantDashboard.tsx`** (lines ~472-497): Update the paywall block to:
  - Display `userRole.venue_name` (e.g. "Subscribing for: **Zii's Place**")
  - Render a simplified VenueSwitcher or dropdown when `allVenueRoles.length > 1`
  - The "View Plans & Subscribe" button already passes the correct `venueId` from `userRole.venue_id`, so switching venues via `switchVenue()` will update the paywall correctly

This is a small, focused UI change — no edge function or database changes needed.

