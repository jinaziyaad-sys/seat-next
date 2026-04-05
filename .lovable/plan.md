

# Redesign: Activity Hub + Rename Loyalty to "Rewards Ready"

## Overview
Two changes: (1) Replace the scrollable active tracking list on home with a compact summary + new "Activity" tab in the bottom nav, and (2) rename "Loyalty" to "Rewards Ready" everywhere.

---

## 1. Home Screen: Compact Active Tracking Summary

**Current problem**: Multiple active orders/waitlist entries push the page down, hiding the nav bar and quick actions.

**New behavior**:
- Show at most 3 active items on the home screen as compact single-line cards (venue logo, name, status badge only -- no ETA details, no message buttons)
- If more than 3 exist, show a "View all (N)" link
- Tapping any summary card or "View all" navigates to the new Activity tab

## 2. New "Activity" Tab in Bottom Navigation

Replace the current 5-tab nav (`Home`, `Food`, `Table`, `Rewards Ready`, `Profile`) with a 5-tab nav that includes Activity:

```text
Home | Food Ready | Table Ready | Rewards Ready | Activity
```

- Move Profile access to the hero avatar button (already exists top-right)
- Remove Profile from bottom nav to make room for Activity

**Activity tab layout** (new component `ActivityFlow.tsx`):
- **Top section**: "Active" -- all current orders and waitlist entries with full detail cards (the current tracking card UI, moved here)
- **Bottom section**: "Needs Attention" -- collected orders not yet rated, seated entries not yet rated, cancelled/rejected entries not yet dismissed
- Empty state when nothing is active

## 3. Rename Loyalty to "Rewards Ready"

- `TabNavigation.tsx`: Change label from `nav.loyalty` to `nav.rewardsReady`, keep Gift icon
- `Index.tsx` quick-action card: Update title text
- `LoyaltyReadyFlow.tsx` header: Update displayed title
- `i18n/en.json` (and other locale files): Add `nav.rewardsReady` key, update `home.loyaltyDesc`

---

## Files to Change

| File | Change |
|---|---|
| `src/components/TabNavigation.tsx` | Replace Profile tab with Activity tab (ClipboardList icon); rename loyalty label |
| `src/pages/Index.tsx` | Truncate active tracking to 3 items with "View all" link; add `activeTab === "activity"` route; rename loyalty card text; remove profile from nav handler |
| `src/components/ActivityFlow.tsx` | **New file** -- full activity view with Active + Needs Attention sections |
| `src/i18n/en.json` | Add `nav.activity`, `nav.rewardsReady`, update loyalty references |
| Other i18n files | Add matching keys |

## Build Order
1. Create `ActivityFlow.tsx` with the full tracking card UI (extracted from Index.tsx)
2. Update `TabNavigation.tsx` (swap Profile for Activity, rename loyalty)
3. Update `Index.tsx` (compact summary on home, route to ActivityFlow, rename loyalty card)
4. Update i18n files

