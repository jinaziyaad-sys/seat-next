

## Plan: Dynamic Party Size Limit Based on Venue Capacity

### Problem
Party size is hardcoded to max 12 in three places in the frontend. The backend already supports any party size via multi-table combinations.

### Key Insight (your point)
The max party size for the UI selector should be the **total venue capacity** (sum of all table capacities). This represents the theoretical max when all tables are free. The actual availability check at booking time already handles the real constraint -- the `check-time-slot-availability` edge function excludes occupied tables and checks if the remaining tables can fit the party. So if two bookings overlap, those tables are already removed from the pool. No backend changes needed.

### Changes

**`src/components/TableReadyFlow.tsx`** (3 locations)

1. Compute `maxPartySize` from venue's `table_configuration`:
   ```ts
   const tableConfig = selectedVenueData?.settings?.table_configuration || [];
   const maxPartySize = tableConfig.length > 0
     ? tableConfig.reduce((sum, t) => sum + t.capacity, 0)
     : 20; // fallback
   ```

2. Update Zod schema to accept dynamic max (line 73-76):
   ```ts
   const getPartyDetailsSchema = (max: number) => z.object({
     partyName: z.string()...,
     partySize: z.number().int().min(1).max(max),
   });
   ```

3. Replace all three `Math.min(12, ...)` and `partySize >= 12` with the dynamic max (lines 75, 1949-1950, 2222-2223).

**`src/pages/WaitlistJoin.tsx`** (lines 215-216)
Same fix -- replace hardcoded 12 with dynamic max from venue config.

### No backend changes
The edge functions (`find-available-table`, `check-time-slot-availability`) already handle occupied table exclusion and multi-table combinations correctly.

