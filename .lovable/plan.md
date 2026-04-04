

# Fix Merchant Loyalty Tab & Patron Stamp Updates

## Three Issues

### 1. "Save Loyalty Program" button always shows even after saving
The button in `LoyaltySettings.tsx` (line 541-544) always says "Save Loyalty Program" with no indication that the program is already saved. It should show "Update Loyalty Program" when editing an existing program, and provide feedback (e.g., change text to "Saved" briefly or disable after save).

**Fix**: Change button label to "Update Loyalty Program" when `programId` exists. After successful save, briefly show a "Saved!" state for 2 seconds.

### 2. Merchant Loyalty tab doesn't match other tabs
The `LoyaltyManagement.tsx` component renders its own inner `Tabs` (Redeem Codes / Program Settings) which is a different structure from other merchant tabs like Kitchen, Waitlist, etc. The other tabs render a single focused board. The loyalty tab has a nested tab layout that feels out of place.

**Fix**: Restructure `LoyaltyManagement.tsx` to match the pattern of other merchant tabs:
- Remove the inner Tabs wrapper
- Show the "Redeem Codes" view as the main content (this is the operational view merchants use daily, like Kitchen/Waitlist boards)
- Move "Program Settings" access to a settings gear icon button in the header that opens `LoyaltySettings` in a Sheet/Dialog
- Add a proper header with title, stats summary, and the search bar — matching the Card-based layout used by KitchenBoard/WaitlistBoard

### 3. Patron stamp card not updating after order collected
The `LoyaltyReadyFlow.tsx` only fetches data once on mount (`useEffect(() => { fetchData(); }, [])`). There's no real-time subscription or polling. When an order is collected and the DB trigger awards a stamp, the patron's UI won't reflect it until they navigate away and come back.

**Fix**: Add a Supabase real-time subscription on `patron_loyalty` filtered by the user's `user_id`. When a change is detected, re-fetch the data. This mirrors how KitchenBoard/WaitlistBoard use real-time subscriptions.

## Files Changed

| File | Change |
|---|---|
| `src/components/merchant/LoyaltySettings.tsx` | Change save button to "Update" when program exists; add saved feedback state |
| `src/components/merchant/LoyaltyManagement.tsx` | Restructure to match other merchant tabs — main board view with settings in a Sheet |
| `src/components/LoyaltyReadyFlow.tsx` | Add real-time subscription on `patron_loyalty` to auto-refresh stamps |

## Build Order
1. Fix save button label and feedback in LoyaltySettings
2. Restructure LoyaltyManagement to match merchant tab patterns
3. Add real-time subscription to LoyaltyReadyFlow

