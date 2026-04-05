

# Homepage Redesign: Loyalty Card + Collapsible Active Tracking

## Problem
1. Loyalty is buried in the quick-actions grid without a distinct identity like "Food Ready" and "Table Ready"
2. Active tracking cards push navigation off-screen when there are multiple undismissed orders/waitlist entries

## Changes

### 1. Rename Loyalty quick-action to "Rewards Ready"
Matches the naming pattern of "Food Ready" and "Table Ready." The card stays in the 3-column grid, third position.

### 2. Redesign Active Tracking as a collapsible summary
Instead of rendering every active card inline on the home page:

- Show a compact **summary bar** with counts (e.g. "2 orders, 1 waitlist") and the most recent 3 items as mini preview rows (venue logo, status badge, one-line info)
- A "View All" button opens a new **"tracking" tab** (full-screen, like food-ready/table-ready tabs)
- The tracking tab has two sections:
  - **Active** (top): orders in `awaiting_verification/placed/in_prep/ready` + waitlist in `waiting/ready`
  - **Needs Attention** (bottom): items needing rating (`collected`/`seated`) or dismissal (`rejected`/`cancelled`/`no_show`) -- essentially undismissed past items

### 3. Bottom nav update
Replace the current 5-tab nav. Remove the standalone "Loyalty" tab (it's accessed via the "Rewards Ready" card). Add an "Activity" tab (clipboard/list icon) that opens the full tracking view. New tabs:
- Home | Food | Table | Activity | Profile

## Files to Change

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Replace inline active tracking section with compact summary (max 3 items + "View All"). Add `activeTab === "tracking"` branch that renders a new full tracking view with Active/Needs Attention split. Update loyalty card label. |
| `src/components/TabNavigation.tsx` | Replace "loyalty" tab with "tracking"/"activity" tab using a ClipboardList or ListChecks icon. |
| `src/i18n/en.json` | Add keys: `nav.activity`, `home.rewardsReady`, `home.viewAllTracking`, `home.needsAttention`, `home.activeItems`, `home.noActiveItems` |

## Technical Detail

**Summary bar on home** (replaces the current full tracking list):
- Combine `activeOrders` + `activeWaitlist` into one sorted array
- Split into `activeItems` (truly active statuses) and `pastItems` (collected/seated/cancelled/rejected/no_show)
- Show up to 3 `activeItems` as compact rows (logo, venue name, status badge -- no ETA, no buttons)
- Show a count badge if there are more: "View all (5)"
- If `pastItems` exist, show a small "X items need your attention" nudge

**Full tracking tab** (`activeTab === "tracking"`):
- Reuses the existing card rendering logic (moved into a helper or kept inline)
- Two scroll sections with headers: "Active" and "Needs Attention"
- All action buttons (rate, dismiss, message, share) remain here
- Back button returns to home

**Loyalty access**: The "Rewards Ready" card in the quick-actions grid navigates to `activeTab === "loyalty"` as before. Patrons can also reach it from the profile or venue-specific flows.

