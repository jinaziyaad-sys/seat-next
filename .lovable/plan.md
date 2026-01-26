
# Comprehensive Analytics Dashboard Overhaul

## Overview
This plan addresses three major concerns with the merchant reports:
1. Data accuracy and reliability issues
2. UI/visual glitches (especially the customer pie chart)
3. Expanding analytics coverage with a flexible date range picker

---

## Problem Analysis

### 1. Accuracy Issues
The current analytics have several potential accuracy problems:
- Edge functions may return incorrect calculations when data is sparse
- The "on-time rate" calculation in `get-venue-analytics` uses a +/- 5 minute window which may not match what's displayed
- Customer segments are calculated in a scheduled job that may not have run recently
- The `daily_venue_snapshots` table appears empty, meaning comparative metrics have no historical data

### 2. UI Glitches (Customer Pie Chart)
The pie chart in `CustomerInsights.tsx` has issues:
- When segment data is all zeros or has very small values, the chart renders incorrectly
- The `label` function may overflow when percentages round to 0%
- No fallback for empty/invalid data states

### 3. Limited Date Selection
Current implementation:
- Fixed presets: Today, 7 days, 30 days, 90 days
- No ability to select custom date ranges
- No awareness of when the venue was created

---

## Technical Implementation

### Phase 1: Fix UI Glitches and Pie Chart

**File: `src/components/merchant/CustomerInsights.tsx`**

1. Add empty state handling for the pie chart:
   - Check if all segment values are 0 before rendering
   - Display a helpful message when no segment data exists

2. Fix label rendering:
   - Only show labels for segments with meaningful values (greater than 5%)
   - Use a custom label renderer that handles edge cases

3. Add proper chart sizing and responsiveness fixes

### Phase 2: Implement Custom Date Range Picker

**New Component: `src/components/merchant/DateRangePicker.tsx`**

Create a reusable date range picker that:
- Accepts the venue's `created_at` date
- Disables dates before venue creation (greyed out)
- Disables future dates
- Provides preset quick selections (Today, Last 7 days, etc.)
- Returns start and end dates

**Updates to All Analytics Components:**

Modify the following files to use the new date picker:
- `MerchantReports.tsx` - Main reports page
- `CustomerInsights.tsx` - Customer analytics tab
- `OperationsEfficiency.tsx` - Operations tab
- `RatingsView.tsx` - Ratings tab
- `CancellationHistory.tsx` - Cancellation history

Each component will:
1. Receive `venueCreatedAt` as a prop
2. Replace the Select dropdown with the DateRangePicker
3. Pass explicit start/end dates to edge functions instead of preset strings

### Phase 3: Update Edge Functions for Custom Date Ranges

**Files to Update:**
- `supabase/functions/get-venue-analytics/index.ts`
- `supabase/functions/get-venue-customer-insights/index.ts`
- `supabase/functions/get-venue-efficiency-analytics/index.ts`

Changes:
1. Accept `start_date` and `end_date` parameters instead of `time_range`
2. Maintain backward compatibility with `time_range` presets
3. Add validation to ensure dates are within valid bounds
4. Improve edge case handling for empty data

### Phase 4: Expand Analytics Coverage

**New Metrics to Add:**

1. **Revenue/Volume Trends** (if order values are tracked):
   - Average order value
   - Total volume by day/week/month

2. **Wait List Conversion Rate**:
   - Percentage of waitlist entries that become seated
   - No-show trends over time

3. **Table Turnover Analytics**:
   - Average time tables are occupied
   - Table utilization rate

4. **Peak Analysis Enhancements**:
   - Heatmap of busy hours by day of week
   - Seasonal trends (if enough data)

5. **Staff Performance Expansion**:
   - Orders per staff member over time
   - Average prep time per staff member

### Phase 5: Enhanced Export Functionality

**File: `src/components/merchant/MerchantExport.tsx`**

Enhancements:
1. Add date range selection for exports (using same DateRangePicker)
2. Option to export all historical data
3. Include additional sheets:
   - Reservation analytics (if applicable)
   - Rating breakdown by period
   - Customer segment changes over time
   - Daily snapshot history

4. Add CSV export option alongside Excel

---

## Detailed Component Changes

### DateRangePicker Component

```text
Props:
- venueCreatedAt: Date
- startDate: Date
- endDate: Date
- onDateChange: (start: Date, end: Date) => void

Features:
- Calendar UI with react-day-picker
- Preset buttons: Today, Last 7 Days, Last 30 Days, Last 90 Days, All Time
- Visual indication of disabled dates (before venue creation)
- Responsive design for mobile
```

### CustomerInsights Pie Chart Fix

```text
Changes:
1. Filter out zero-value segments before rendering
2. Handle edge case where all segments are 0
3. Improve label positioning and readability
4. Add legend below chart for accessibility
5. Use consistent color scheme from chart variables
```

### MerchantReports Header Update

```text
Current:
- Time range Select dropdown
- Export button

New:
- DateRangePicker with visual calendar
- Export button (now respects selected date range)
- Quick preset chips below the picker
```

---

## Database Considerations

### Ensure Daily Snapshots Are Running

The `daily_venue_snapshots` table is currently empty, which means:
- Comparative metrics show no data
- Historical trends cannot be calculated

This requires setting up the cron job as documented in `ANALYTICS_SETUP.md`. The UI should gracefully handle missing snapshot data.

### Optimize Queries for Large Date Ranges

When users select "All Time":
- Add pagination or chunking for very large datasets
- Consider creating summary tables for old data
- Implement query limits with pagination for exports

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/components/merchant/DateRangePicker.tsx` | NEW - Custom date range picker component |
| `src/components/merchant/MerchantReports.tsx` | Replace Select with DateRangePicker, pass venueCreatedAt |
| `src/components/merchant/CustomerInsights.tsx` | Fix pie chart, add DateRangePicker, improve empty states |
| `src/components/merchant/OperationsEfficiency.tsx` | Add DateRangePicker, improve data handling |
| `src/components/merchant/RatingsView.tsx` | Add date filtering capability |
| `src/components/merchant/CancellationHistory.tsx` | Replace 7-day limit with custom date range |
| `src/components/merchant/MerchantExport.tsx` | Add date range selection, expand export options |
| `supabase/functions/get-venue-analytics/index.ts` | Accept start_date/end_date params |
| `supabase/functions/get-venue-customer-insights/index.ts` | Accept start_date/end_date params |
| `supabase/functions/get-venue-efficiency-analytics/index.ts` | Accept start_date/end_date params |

---

## Implementation Priority

1. **High Priority**: Fix pie chart UI glitches (immediate user-facing issue)
2. **High Priority**: Implement date range picker with venue creation awareness
3. **Medium Priority**: Update edge functions for custom date ranges
4. **Medium Priority**: Expand export functionality
5. **Lower Priority**: Add additional analytics metrics

---

## Expected Outcomes

After implementation:
- Charts will render correctly with proper empty states
- Users can select any date range from venue creation to today
- All analytics tabs will respect the selected date range
- Exports will include full historical data
- Comparative metrics will work once daily snapshots are populated
