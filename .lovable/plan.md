

# Improve ETA Accuracy for Waitlist, Reservations & Food Prep

## Current Weaknesses

1. **Waitlist ETA**: Uses a flat 5 min/person queue multiplier instead of learning actual turnover rates. `get_venue_capacity_status` uses UTC `EXTRACT(HOUR FROM now())` instead of venue-local time for snapshot lookups. No recency weighting — a 30-day-old data point counts the same as yesterday's.

2. **Food Prep ETA**: Same lack of recency weighting. Kitchen load multiplier uses fixed thresholds (3/7) rather than learning from the venue's actual patterns. No feedback loop showing merchants how accurate predictions were.

3. **Capacity Status**: Uses hardcoded baseline of 10 orders when no historical average exists. Doesn't factor in the venue's configured `venue_capacity` (guest count) at all.

## Plan

### 1. Fix capacity status to use venue-local time and configured capacity

**File**: New migration

- Update `get_venue_capacity_status` to accept timezone param, convert `now()` to local time for snapshot lookups
- Use the venue's `settings->>'venue_capacity'` as the denominator instead of hardcoded 10
- Fall back to historical average only when venue_capacity isn't set

### 2. Replace fixed 5-min queue multiplier with learned turnover rate

**File**: New migration (update `calculate_dynamic_wait_time`)

- Query `waitlist_analytics` for actual per-position wait times at this venue (how long each person ahead typically waits)
- Calculate `avg_turnover_minutes = AVG(actual_wait_time) / AVG(position_at_join)` from recent data
- Use that instead of the hardcoded `5 * queue_length`
- Fall back to 5 min/person when insufficient data

### 3. Add recency weighting to both ETA functions

**File**: New migration (update both `calculate_dynamic_prep_time` and `calculate_dynamic_wait_time`)

- Weight recent data more heavily: orders/entries from last 7 days count 3x, 8-14 days count 2x, 15-30 days count 1x
- Use weighted average instead of simple `AVG()`
- This makes the system adapt faster to operational changes (new chef, menu change, etc.)

### 4. Update `calculate-waitlist-eta` edge function to pass timezone to capacity check

**File**: `supabase/functions/calculate-waitlist-eta/index.ts`

- Pass venue timezone when calling the updated capacity function
- Also query active reservations arriving within next 30 min to factor imminent load into the ETA

### 5. Add ETA accuracy tracking to merchant dashboard

**File**: `src/components/merchant/SmartInsights.tsx` (or new component)

- Query `order_analytics` and `waitlist_analytics` comparing `quoted_prep_time` vs `actual_prep_time` and `quoted_wait_time` vs `actual_wait_time`
- Show accuracy percentage and average deviation
- This gives merchants visibility into how well the system is predicting

## Technical Details

### Updated `get_venue_capacity_status` (migration)
```sql
CREATE OR REPLACE FUNCTION public.get_venue_capacity_status(p_venue_id UUID)
RETURNS TABLE(...) AS $$
DECLARE
  v_venue_capacity INTEGER;
  v_venue_timezone TEXT;
  v_local_hour INTEGER;
  v_local_dow INTEGER;
BEGIN
  -- Get configured capacity + timezone
  SELECT 
    COALESCE((settings->>'venue_capacity')::INT, 40),
    COALESCE(timezone, 'Africa/Johannesburg')
  INTO v_venue_capacity, v_venue_timezone
  FROM venues WHERE id = p_venue_id;
  
  -- Use venue-local time for snapshot lookup
  v_local_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE v_venue_timezone));
  v_local_dow := EXTRACT(DOW FROM (now() AT TIME ZONE v_venue_timezone));
  
  -- ... use v_venue_capacity as denominator for percentage
END;
$$
```

### Updated `calculate_dynamic_wait_time` — learned turnover
```sql
-- Replace: v_position_mult := p_current_waitlist_length * 5;
-- With:
SELECT COALESCE(
  AVG(actual_wait_time)::NUMERIC / NULLIF(COUNT(*), 0),
  5.0
) INTO v_per_person_rate
FROM waitlist_analytics
WHERE venue_id = p_venue_id
  AND actual_wait_time IS NOT NULL
  AND joined_at > (now() - INTERVAL '14 days');

v_position_mult := p_current_waitlist_length * v_per_person_rate;
```

### Recency weighting example
```sql
SELECT 
  SUM(actual_prep_time * CASE
    WHEN placed_at > now() - INTERVAL '7 days' THEN 3
    WHEN placed_at > now() - INTERVAL '14 days' THEN 2
    ELSE 1
  END) / SUM(CASE
    WHEN placed_at > now() - INTERVAL '7 days' THEN 3
    WHEN placed_at > now() - INTERVAL '14 days' THEN 2
    ELSE 1
  END)
INTO v_avg_prep_time
FROM order_analytics
WHERE ...
```

## Files Changed

| File | Change |
|------|--------|
| New migration | Update 3 DB functions: `get_venue_capacity_status`, `calculate_dynamic_wait_time`, `calculate_dynamic_prep_time` |
| `supabase/functions/calculate-waitlist-eta/index.ts` | Pass imminent reservations count to capacity consideration |
| `src/components/merchant/SmartInsights.tsx` | Add ETA accuracy insight card |

