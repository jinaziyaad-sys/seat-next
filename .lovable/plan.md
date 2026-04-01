

# Fix: Timezone Bugs in Analytics Display

## Problem
Orders created at 10 PM show as 7 PM in merchant analytics — a 3-hour offset indicating times are being displayed in UTC instead of the venue's local timezone.

## Root Causes Found

### 1. `get-venue-efficiency-analytics` — typo crashes timezone lookup
Line 30 references `supabaseClient` instead of `supabase`. This is an **undefined variable**, so the timezone fetch fails silently. The function either crashes or falls back incorrectly.

### 2. `get-venue-efficiency-analytics` — prep time trend uses UTC dates
Line 146 uses `new Date(o.placed_at).toISOString().split('T')[0]` which gives the UTC date, not the venue-local date. Late-night orders get bucketed to the wrong day.

### 3. `order_analytics.hour_of_day` stored correctly but not always used
The `track_order_analytics` trigger already stores venue-local `hour_of_day` and `day_of_week` in the `order_analytics` table. But the edge functions re-derive hours from `placed_at` using `getVenueLocalHour()`. This is fine when the timezone lookup works — but due to bug #1, it doesn't.

### 4. Frontend display of order timestamps
Need to verify that any direct timestamp display (e.g., in tables or tooltips) uses venue timezone formatting rather than raw UTC or browser-local time.

## Fix Plan

### 1. Fix `supabaseClient` typo in efficiency analytics
**File**: `supabase/functions/get-venue-efficiency-analytics/index.ts`
- Line 30: Change `supabaseClient` → `supabase`

### 2. Fix prep time trend to use venue-local dates
**Same file**, line 146: Use `getVenueLocalComponents()` or `Intl.DateTimeFormat` to get the venue-local date string instead of UTC.

### 3. Verify `get-venue-analytics` function
This function already correctly uses `getVenueLocalHour` with `venueTimezone` and doesn't have the typo — confirmed working.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/get-venue-efficiency-analytics/index.ts` | Fix `supabaseClient` → `supabase` typo; fix prep time trend date grouping to use venue timezone |

Single edge function fix — no frontend or migration changes needed.

