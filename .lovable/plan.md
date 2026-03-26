

# Location-Based Venue Search with Radius & Custom Location

## Problem
Currently, the Explore Venues page fetches **all** venues from the database with no distance filtering. Every restaurant on the platform shows up regardless of how far away it is.

## Solution
Add two features to the patron's Explore page:
1. **Search radius** — a configurable distance filter (default 25km, options: 10/25/50/100km)
2. **Custom location ("Passport" mode)** — let patrons search in a different city by typing an address/city name, geocoded via a free API

## Changes

### 1. Edge Function: `get-venue-recommendations/index.ts`
- Accept new `radius_km` parameter from the request body
- After calculating distances, **filter out** venues beyond the radius (only when location is provided)
- If no location is provided, return all venues (current behavior)

### 2. Frontend: `src/components/ExploreVenues.tsx`
- Add state for `searchRadius` (default 25) and `customLocation` (null = use device GPS)
- Add a **location bar** below the search input showing current location mode:
  - "Using your location" with a pencil/edit icon, or
  - "Searching in: Durban" with an X to clear
- Tapping edit opens a **location search input** where the patron types a city/address
  - Use the existing `validate-address` edge function (or a simple geocoding call) to resolve coordinates
- Add a **radius selector** as a row of chips: `10km`, `25km`, `50km`, `100km`
- Pass `radius_km` and the active location to `fetchRecommendations`
- When custom location is set, pass those coords instead of GPS coords
- Persist the patron's last-used radius in localStorage

### 3. Edge Function: `validate-address/index.ts` (reuse)
- Already exists for address validation — check if it returns lat/lng coordinates that can be reused for the location search. If not, add a lightweight geocoding call using the Lovable AI gateway or a free geocoding service.

## UI Layout (below existing search bar)

```text
┌─────────────────────────────────────────┐
│ 📍 Using your location  [Change]        │
│                                         │
│ Radius: [10km] [25km●] [50km] [100km]  │
└─────────────────────────────────────────┘
```

When "Change" is tapped:
```text
┌─────────────────────────────────────────┐
│ 🔍 Search a city or address...    [✕]   │
│                                         │
│ Radius: [10km] [25km●] [50km] [100km]  │
└─────────────────────────────────────────┘
```

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/get-venue-recommendations/index.ts` | Add `radius_km` param, filter venues by distance |
| `src/components/ExploreVenues.tsx` | Add location bar, radius chips, custom location input, pass params to edge function |
| `supabase/functions/validate-address/index.ts` | Verify it returns lat/lng (reuse for geocoding) |

