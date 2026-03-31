

# Complete the Referral System UX

## Current State
- Backend: `venue_referral_config` table, `referral_codes` table, `referral_completions` table, and `process-referral` edge function all exist
- Patron can generate a referral code and copy it
- **Missing**: No way for the referee (person receiving the code) to enter it anywhere
- **Missing**: No explanation of what the referral does or how it benefits either party
- **Missing**: No share functionality beyond copy

## Plan

### 1. Add "Enter Referral Code" Input on Patron Loyalty Card
**File**: `src/components/PatronLoyaltyCard.tsx`

In the expanded referral section, below the "Share your code" block, add:
- A text input field: "Have a referral code? Enter it here"
- A submit button that calls the `process-referral` edge function
- Success/error toast feedback ("Referral applied! You earned X stamps")
- Once used, show "Referral applied" instead of the input (check `referral_completions` for this venue)

### 2. Improve Share UX
**File**: `src/components/PatronLoyaltyCard.tsx`

Replace bare "Copy" with a richer share section:
- Add a "Share" button that uses the Web Share API (falls back to copy)
- Include a short pre-written message: "Join me at [Venue Name]! Use my code ABC123 to earn bonus rewards."
- Show a brief explainer: "You both earn [reward] when they use your code"

### 3. Fetch Referral Completion Status
**File**: `src/components/PatronLoyaltyCard.tsx`

Query `referral_completions` where `referee_id = user.id` per venue to determine if the patron has already used a referral code, so we hide the input and show "Referral applied" instead.

### 4. Add Reward Info Display
Show the configured rewards from `venue_referral_config` in the referral section:
- "Refer a friend: You get [X stamps], they get [Y stamps]"
- This gives context to why the patron should share

## Files Changed

| File | Change |
|------|--------|
| `src/components/PatronLoyaltyCard.tsx` | Add referral code input, share button, completion status check, reward info display |

No database or edge function changes needed — all backend pieces exist.

