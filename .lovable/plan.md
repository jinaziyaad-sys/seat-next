

# Improve Loyalty Card Clarity & Show Reward Goal

## Problem
The patron has 1/10 stamps but the card doesn't explain:
1. What reward they're earning toward (e.g., "Free Dessert")
2. How many more stamps/points they need
3. What happens when they reach the threshold

The expanded view only shows "Lifetime: 1 stamps earned" — no motivation or goal.

## Plan

### 1. Fetch reward info alongside loyalty data
**File**: `src/components/PatronLoyaltyCard.tsx`

- Add `reward_name` and `reward_description` to `LoyaltyCardData` interface
- In `fetchLoyaltyData`, also query `loyalty_rewards` for each program and include the next available reward info in the card data

### 2. Show reward goal on the card (always visible)
**File**: `src/components/PatronLoyaltyCard.tsx`

- Below the stamp dots, show: **"5 more stamps to unlock: Free Dessert"** (or whatever the reward name is)
- If no reward is configured, show generic: "Keep collecting stamps!"
- For points: **"30 more points to unlock: 10% Off"**

### 3. Improve expanded section
**File**: `src/components/PatronLoyaltyCard.tsx`

- When expanded and no active codes, show a progress summary instead of just lifetime stats:
  - Progress bar or percentage toward next reward
  - Reward description if available
  - Lifetime stats moved to a smaller secondary line

### Files Changed

| File | Change |
|------|--------|
| `src/components/PatronLoyaltyCard.tsx` | Add reward goal display, fetch reward details, improve expanded view |

