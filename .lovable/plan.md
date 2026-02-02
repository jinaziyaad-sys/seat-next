
# Merchant Settings Audit & Cleanup Plan

## Overview

This plan audits all merchant settings to identify redundancies, verify patron-side translations, and fix any issues found.

## Current Settings Inventory

| Setting | Location | Used By Patron | Used By Edge Function | Status |
|---------|----------|----------------|----------------------|--------|
| `default_prep_time` | Kitchen Settings | Yes (FoodReadyFlow) | Yes (calculate-order-eta) | Working |
| `max_extension_time` | Kitchen Settings | No | Yes (KitchenBoard, WaitlistBoard) | Working |
| `pickup_instructions` | Pickup Instructions | Yes (FoodReadyFlow) | No | Working |
| `order_number_refresh_minutes` | Kitchen Settings | Yes (FoodReadyFlow duplicate check) | No | Working |
| `prep_time_mode` | Kitchen Settings | No (backend only) | Yes (calculate-order-eta) | Working |
| `venue_capacity` | NOT DISPLAYED IN UI | No | Yes (get_venue_capacity_status) | Hidden but used |
| `tables_per_interval` | NOT DISPLAYED IN UI | No | No usage found | Potentially redundant |
| `auto_no_show_time` | Auto No-Show Settings | No | Yes (auto-cancel-expired-waitlist) | Working |
| `business_hours` | Business Hours | Yes (venue status checks) | Yes (cleanup functions) | Working |
| `holiday_closures` | Business Hours | Yes (venue status checks) | No | Working |
| `grace_periods` | Business Hours | Yes (FoodReadyFlow, TableReadyFlow, WaitlistJoin) | No | Working |
| `auto_cleanup_cancelled_waitlist` | Operations & Cleanup | No | Yes (cleanup-cancelled-waitlist) | Working |
| `auto_cleanup_rejected` | Operations & Cleanup | No | Yes (cleanup-rejected-orders) | Working |
| `cob_time` | Operations & Cleanup | No | Yes (cleanup functions) | Working |
| `use_closing_time_for_cleanup` | Operations & Cleanup | No | Not yet implemented | Needs backend update |
| `waitlist_preferences` | Waitlist Preferences | Yes (WaitlistJoin, TableReadyFlow) | No | Working |
| `table_configuration` | Table Configuration | No | Yes (find-available-table) | Working |

---

## Issues Identified

### 1. Hidden Settings (venue_capacity, tables_per_interval)

These settings exist in the database but have NO UI in MerchantSettings:
- `venue_capacity` - Used by capacity status calculations but never editable
- `tables_per_interval` - Stored but never used anywhere

**Action:** Add UI for `venue_capacity` (useful), remove `tables_per_interval` (redundant)

### 2. use_closing_time_for_cleanup Not Used by Backend

The frontend saves `use_closing_time_for_cleanup` and conditionally nullifies `cob_time`, but the cleanup edge functions:
- `cleanup-rejected-orders/index.ts`
- `cleanup-cancelled-waitlist/index.ts`

Still read `cob_time` directly without checking the new flag. When "Yes" is selected, `cob_time` becomes null, but the cleanup functions fall back to "23:00" instead of using actual business closing time.

**Action:** Update cleanup functions to respect `use_closing_time_for_cleanup` flag and derive cleanup time from `business_hours` when enabled

### 3. Patron-Side Settings Not Visible Where Expected

Some settings the patron should see but may be missing:
- `business_hours` - Patron sees open/closed status but not the actual hours
- `grace_periods` - Used for blocking but patron doesn't see "kitchen closes in X minutes"

**Action:** Consider adding business hours display to venue info in patron flows

---

## Implementation Plan

### Phase 1: Add Missing UI for venue_capacity

Add a `venue_capacity` field to the appropriate accordion section (likely Business Hours or a new Capacity section).

**File:** `src/components/merchant/MerchantSettings.tsx`

```typescript
// Inside Business Hours or new section
<div>
  <Label htmlFor="venueCapacity">Venue Capacity (guests)</Label>
  <Input
    id="venueCapacity"
    type="number"
    value={settings.venueCapacity}
    onChange={(e) => handleInputChange("venueCapacity", e.target.value)}
    className="w-24"
  />
  <p className="text-sm text-muted-foreground mt-1">
    Maximum number of guests your venue can accommodate
  </p>
</div>
```

### Phase 2: Fix Cleanup Edge Functions

Update both cleanup functions to check `use_closing_time_for_cleanup`:

**Files:**
- `supabase/functions/cleanup-rejected-orders/index.ts`
- `supabase/functions/cleanup-cancelled-waitlist/index.ts`

```typescript
// Get COB time - either from setting or from business hours
let cobTime = settings.cob_time;

if (settings.use_closing_time_for_cleanup !== false) {
  // Use actual business closing time for today
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[now.getDay()];
  const todayHours = settings.business_hours?.[today];
  
  if (todayHours && !todayHours.is_closed) {
    cobTime = todayHours.close;
  }
}

// Fall back to default if still no time
cobTime = cobTime || '23:00';
```

### Phase 3: Remove Redundant tables_per_interval

This setting is saved but never used. Remove it from:
1. State initialization in MerchantSettings
2. Save logic in handleSaveAll
3. Initial refs setup

**Or** if there's a future use case, keep it but add UI for it.

### Phase 4: Enhance Patron Visibility (Optional)

Add business hours display to:
- `WaitlistJoin.tsx` - Show venue hours
- `FoodReadyFlow.tsx` - Show "kitchen closes at X" warning when near closing

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/merchant/MerchantSettings.tsx` | Add venue_capacity UI, potentially remove tables_per_interval |
| `supabase/functions/cleanup-rejected-orders/index.ts` | Use business_hours closing time when use_closing_time_for_cleanup is true |
| `supabase/functions/cleanup-cancelled-waitlist/index.ts` | Use business_hours closing time when use_closing_time_for_cleanup is true |

---

## Testing Checklist

After implementation:
1. Verify venue_capacity field saves and loads correctly
2. Test cleanup time logic:
   - Set "Yes - Use business closing time" and verify cleanup runs at actual closing
   - Set "No - Use custom time" and verify custom time is respected
3. Confirm all existing settings still save/load properly
4. Check patron flows still receive correct settings (business hours, grace periods, pickup instructions)

---

## Summary

- 2 hidden settings need UI or removal
- 1 backend logic bug (use_closing_time_for_cleanup not implemented in edge functions)
- All other settings are working correctly between merchant and patron
- The waitlist preferences, business hours, grace periods, and pickup instructions all correctly translate to patron side
