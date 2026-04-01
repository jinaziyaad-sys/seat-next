

# Add Staff Performance Under Analytics

## What changes
Instead of creating a separate tab, add a **Staff Performance section** within the existing "Operations" tab in MerchantReports. This keeps all operational analytics together and avoids tab overload.

## Plan

### 1. Create StaffPerformance component
**New file**: `src/components/merchant/StaffPerformance.tsx`

- Accepts `venueId` and date range props
- Queries `orders` joined with `order_analytics` grouped by `prepared_by_staff_id` and `marked_ready_by_staff_id`
- Fetches staff names from `profiles` via the staff IDs found
- Displays a table: staff name, orders handled, avg prep time, on-time %
- Highlights top performer with a badge
- Shows a SmartInsights block with `type="staff"`

### 2. Create edge function for staff analytics
**New file**: `supabase/functions/get-venue-staff-analytics/index.ts`

- Accepts `venueId`, `startDate`, `endDate`
- Validates JWT and checks caller is venue staff/admin
- Joins `orders` + `order_analytics` + `profiles` to aggregate per-staff metrics
- Returns: `{ staff: [{ id, name, ordersHandled, avgPrepTime, onTimeRate }] }`

### 3. Extend SmartInsights with staff type
**Edit**: `src/components/merchant/SmartInsights.tsx`

- Add `"staff"` to the `type` union
- Add `staffMetrics` to `InsightData` (workload distribution, top/bottom performers)
- Generate insights like:
  - "Workload imbalance — [Name] handles X% of orders"
  - "[Name] has fastest prep at Y min"
  - "No staff attribution on Z% of orders — ensure staff log in"

### 4. Embed in Operations tab
**Edit**: `src/components/merchant/OperationsEfficiency.tsx`

- Import and render `StaffPerformance` below the existing efficiency charts
- Pass through the venue ID and date range

## Files

| File | Change |
|------|--------|
| `src/components/merchant/StaffPerformance.tsx` | New — staff metrics table + insights |
| `supabase/functions/get-venue-staff-analytics/index.ts` | New — server-side aggregation |
| `src/components/merchant/SmartInsights.tsx` | Add staff insight type and logic |
| `src/components/merchant/OperationsEfficiency.tsx` | Render StaffPerformance section |

