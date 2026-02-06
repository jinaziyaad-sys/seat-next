

# Timezone Alignment Across the Platform

## Problem Analysis

The application currently has inconsistent timezone handling across multiple areas:

### 1. Database Triggers (Critical Issue)
```sql
EXTRACT(DOW FROM NEW.created_at)::INTEGER  -- Uses database server timezone (UTC)
EXTRACT(HOUR FROM NEW.created_at)::INTEGER -- Uses database server timezone (UTC)
```

When an order is placed at **6:00 PM local time (SAST/UTC+2)**, the database stores:
- `created_at`: `2026-02-06T16:00:00Z` (correct UTC)
- `hour_of_day`: **16** (should be 18 for SAST)
- `day_of_week`: Could be wrong near midnight

This causes analytics to show "peak hours" at wrong times.

### 2. Edge Functions
Functions like `calculate-order-eta` and `calculate-waitlist-eta` use:
```typescript
const dayOfWeek = now.getDay();     // Uses Deno server timezone (UTC)
const hourOfDay = now.getHours();    // Uses Deno server timezone (UTC)
```

### 3. Frontend Date Queries
Reports and analytics send ISO timestamps which are correctly handled, but the **returned hourly distribution data** is still based on UTC hour extraction.

### 4. Reservation Time Slots (Partially Fixed)
The recent fix converts local times to ISO before sending to the edge function - this is correct and should be the pattern everywhere.

## Solution: Venue-Based Timezone

### Approach
Store a `timezone` field on each venue (e.g., `"Africa/Johannesburg"`) and use it consistently:

1. **Database Layer**: Extract hour/day using venue's timezone
2. **Edge Functions**: Convert UTC to venue timezone before processing
3. **Frontend**: Display all times in venue/local timezone
4. **Analytics**: Aggregate data using venue timezone

## Implementation Plan

### Phase 1: Add Timezone to Venues

**Database Migration**:
```sql
-- Add timezone column to venues (default to South Africa for existing venues)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Johannesburg';

-- Add comment for documentation
COMMENT ON COLUMN venues.timezone IS 'IANA timezone identifier for venue location';
```

**Update Merchant Settings UI**:
Add timezone selector in `src/components/merchant/MerchantSettings.tsx`:
```tsx
<Select value={timezone} onValueChange={setTimezone}>
  <SelectItem value="Africa/Johannesburg">South Africa (SAST)</SelectItem>
  <SelectItem value="Africa/Lagos">West Africa (WAT)</SelectItem>
  <SelectItem value="Europe/London">UK (GMT/BST)</SelectItem>
  {/* More common timezones */}
</Select>
```

### Phase 2: Fix Database Trigger Functions

Update `track_order_analytics()` to use venue timezone:

```sql
CREATE OR REPLACE FUNCTION public.track_order_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items_count INTEGER;
  v_quoted_time INTEGER;
  v_venue_timezone TEXT;
  v_local_timestamp TIMESTAMPTZ;
BEGIN
  -- Get venue timezone
  SELECT COALESCE(timezone, 'Africa/Johannesburg') INTO v_venue_timezone
  FROM venues WHERE id = NEW.venue_id;
  
  -- Convert to venue local time for analytics
  v_local_timestamp := NEW.created_at AT TIME ZONE v_venue_timezone;
  
  -- Count items
  v_items_count := jsonb_array_length(COALESCE(NEW.items, '[]'::jsonb));
  
  IF TG_OP = 'INSERT' AND NEW.status != 'rejected' THEN
    IF NEW.eta IS NOT NULL THEN
      v_quoted_time := EXTRACT(EPOCH FROM (NEW.eta - NEW.created_at))::INTEGER / 60;
    ELSE
      v_quoted_time := 15;
    END IF;
    
    INSERT INTO public.order_analytics (
      venue_id, order_id, placed_at, quoted_prep_time,
      day_of_week, hour_of_day, items_count
    ) VALUES (
      NEW.venue_id, NEW.id, NEW.created_at, v_quoted_time,
      EXTRACT(DOW FROM v_local_timestamp)::INTEGER,   -- Use LOCAL time
      EXTRACT(HOUR FROM v_local_timestamp)::INTEGER,  -- Use LOCAL time
      v_items_count
    );
  END IF;
  
  -- ... rest of function
END;
$function$
```

Apply similar fix to `track_waitlist_analytics()`.

### Phase 3: Fix Edge Functions

**Create shared timezone utility**:
```typescript
// supabase/functions/_shared/timezone.ts
export function getVenueLocalTime(utcTime: Date, timezone: string): Date {
  // Convert UTC to venue local time
  return new Date(utcTime.toLocaleString('en-US', { timeZone: timezone }));
}

export function getVenueLocalHour(utcTime: Date, timezone: string): number {
  const local = getVenueLocalTime(utcTime, timezone);
  return local.getHours();
}

export function getVenueLocalDayOfWeek(utcTime: Date, timezone: string): number {
  const local = getVenueLocalTime(utcTime, timezone);
  return local.getDay();
}
```

**Update calculate-order-eta**:
```typescript
// Fetch venue with timezone
const { data: venue } = await supabase
  .from('venues')
  .select('settings, timezone')
  .eq('id', venue_id)
  .single();

const timezone = venue?.timezone || 'Africa/Johannesburg';
const now = new Date();
const dayOfWeek = getVenueLocalDayOfWeek(now, timezone);
const hourOfDay = getVenueLocalHour(now, timezone);
```

**Update calculate-waitlist-eta** with same pattern.

### Phase 4: Fix Analytics Edge Functions

**Update get-venue-analytics**:
```typescript
// When building hourly distribution, use venue timezone
const venueTimezone = venue?.timezone || 'Africa/Johannesburg';

const hourlyOrders = Array(24).fill(0);
orderAnalytics?.forEach(o => {
  // Convert placed_at (stored as UTC) to venue local hour
  const localHour = getVenueLocalHour(new Date(o.placed_at), venueTimezone);
  hourlyOrders[localHour] = (hourlyOrders[localHour] || 0) + 1;
});
```

**Update get-venue-efficiency-analytics** with same pattern.

### Phase 5: Frontend Display Consistency

**Create timezone display utility**:
```typescript
// src/utils/timezone.ts
export function formatTimeInVenueTimezone(
  isoTimestamp: string,
  venueTimezone: string,
  format: 'time' | 'datetime' | 'date' = 'datetime'
): string {
  const date = new Date(isoTimestamp);
  const options: Intl.DateTimeFormatOptions = { timeZone: venueTimezone };
  
  switch (format) {
    case 'time':
      return date.toLocaleTimeString('en-ZA', { ...options, hour: '2-digit', minute: '2-digit' });
    case 'date':
      return date.toLocaleDateString('en-ZA', options);
    default:
      return date.toLocaleString('en-ZA', options);
  }
}
```

Use this utility in:
- Merchant dashboard time displays
- Patron order/waitlist ETA displays
- Analytics charts (hourly labels)
- Export data formatting

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add `timezone` column to venues |
| `track_order_analytics()` | Modify | Use venue timezone for hour/day extraction |
| `track_waitlist_analytics()` | Modify | Use venue timezone for hour/day extraction |
| `supabase/functions/_shared/timezone.ts` | Create | Shared timezone utilities |
| `supabase/functions/calculate-order-eta/index.ts` | Modify | Use venue timezone |
| `supabase/functions/calculate-waitlist-eta/index.ts` | Modify | Use venue timezone |
| `supabase/functions/get-venue-analytics/index.ts` | Modify | Use venue timezone for hourly aggregation |
| `supabase/functions/get-venue-efficiency-analytics/index.ts` | Modify | Use venue timezone |
| `src/utils/timezone.ts` | Create | Frontend timezone display utilities |
| `src/components/merchant/MerchantSettings.tsx` | Modify | Add timezone selector |

## Benefits

1. **Accurate Peak Hour Analytics**: 6 PM rush hour shows correctly as 18:00, not 16:00
2. **Correct ETA Predictions**: Historical data queried by matching local time conditions
3. **Consistent User Experience**: Patrons and merchants see times in their local timezone
4. **Future Multi-Region Support**: Each venue can have its own timezone

## Default Timezone Strategy

For simplicity and the stated use case (99% same timezone):
- Default to `Africa/Johannesburg` for existing venues
- New venues inherit default but can be changed
- All times displayed using venue timezone

## Testing Checklist

1. Create an order at 6 PM local and verify analytics show hour 18
2. Check that hourly distribution chart shows correct peak times
3. Verify ETA calculations use correct local hour for historical matching
4. Confirm reservation time slots display correctly across timezone boundaries
5. Test exports show local times, not UTC

