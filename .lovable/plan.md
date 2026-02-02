
# Merchant Settings Audit & Cleanup Plan

## Status: ✅ COMPLETED

---

## Summary of Changes

### ✅ Phase 1: Fixed Cleanup Edge Functions
Both `cleanup-rejected-orders` and `cleanup-cancelled-waitlist` now respect the `use_closing_time_for_cleanup` flag:
- When enabled (default): Uses actual business closing time from `business_hours` for today
- When disabled: Uses custom `cob_time` setting
- Falls back to 23:00 if neither is set

### ✅ Phase 2: Added venue_capacity UI
Added editable `venue_capacity` field to the Waitlist Preferences section in MerchantSettings.

### ✅ Phase 3: Removed Redundant tables_per_interval
Removed `tables_per_interval` from:
- State initialization
- Loading logic
- Save logic
- Initial refs

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/merchant/MerchantSettings.tsx` | Added venue_capacity UI, removed tables_per_interval |
| `supabase/functions/cleanup-rejected-orders/index.ts` | Now respects use_closing_time_for_cleanup flag |
| `supabase/functions/cleanup-cancelled-waitlist/index.ts` | Now respects use_closing_time_for_cleanup flag |

---

## Testing Checklist

After implementation:
1. ✅ Verify venue_capacity field appears in Waitlist Preferences section
2. ✅ Test cleanup time logic respects business hours when toggle is enabled
3. ✅ Confirm all existing settings still save/load properly
4. ✅ Check patron flows still receive correct settings
