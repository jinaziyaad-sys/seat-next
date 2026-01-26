
# Patron Yearly Recap - "Your Year in Review"

## Overview
Build a Spotify Wrapped-style yearly recap experience for patrons, showing personalized statistics about their activity over the year. The recap will be a fullscreen, multi-slide animated experience that patrons can tap through.

## What the Recap Will Show

### Slide 1: Welcome
- "Your 2025 in Review" with animated entrance
- Patron's name personalized greeting

### Slide 2: Total Activity
- Total orders placed this year
- Total waitlist joins / reservations
- "You were quite the regular!" type messaging

### Slide 3: Favorite Venue
- Most visited venue name
- Number of visits to that venue
- "This was your go-to spot!"

### Slide 4: Time Stats
- Busiest month for the patron
- Most active day of the week
- "Saturdays were your thing!"

### Slide 5: Speed Stats
- Average wait time for food orders
- Average wait time for tables
- Fun comparison messaging

### Slide 6: Rating Summary
- Average rating given
- Total ratings submitted
- "You're a generous rater!" or "You have high standards!"

### Slide 7: Thank You / Share
- "Thanks for a great year!"
- Option to share or close

---

## Technical Implementation

### 1. New Edge Function: `get-patron-yearly-recap`
Creates an edge function that calculates all recap statistics for a patron for a given year.

**Data Gathered:**
- Total orders (from `orders` table where `user_id` = patron and `created_at` in year)
- Total waitlist joins (from `waitlist_entries` table)
- Favorite venue (venue with most combined orders + waitlist)
- Busiest month (month with most activity)
- Busiest day of week (from analytics tables)
- Average prep/wait times (from `order_analytics` and `waitlist_analytics`)
- Ratings given (from `order_ratings` and `waitlist_ratings`)
- Member since date (from `profiles.created_at`)

**Response Structure:**
```json
{
  "year": 2025,
  "patron_name": "John",
  "member_since": "2024-03-15",
  "stats": {
    "total_orders": 47,
    "total_waitlist_joins": 23,
    "total_reservations": 12,
    "favorite_venue": { "name": "Cafe Luna", "visits": 18 },
    "busiest_month": { "month": 7, "count": 12 },
    "busiest_day": { "day": 6, "day_name": "Saturday", "count": 15 },
    "avg_order_wait_minutes": 12,
    "avg_table_wait_minutes": 8,
    "ratings_given": 31,
    "avg_rating_given": 4.2,
    "venues_visited": 5
  }
}
```

### 2. New Component: `YearlyRecap.tsx`
A fullscreen overlay component with multiple animated slides.

**Features:**
- Fullscreen black/gradient background with animated elements
- Tap/swipe to advance through slides (or auto-advance with pause on tap)
- Progress dots at bottom showing current slide
- Framer Motion animations for each slide entrance
- Close button to exit
- Uses existing motion utilities from `src/components/ui/motion.tsx`

**Slide Navigation:**
- Tap anywhere to go to next slide
- Swipe gestures supported
- Back button on each slide
- Skip to end option

### 3. New Hook: `useYearlyRecap.ts`
Custom hook to fetch and manage recap data.

**Functions:**
- `fetchRecap(year: number)` - Calls edge function
- `hasSeenRecap(year: number)` - Checks localStorage
- `markRecapSeen(year: number)` - Saves to localStorage
- `shouldShowRecap()` - Logic for auto-display at year end

### 4. Trigger Logic in `Index.tsx`

**Test Mode (Temporary):**
- Add a "Preview Your Year" button in the Profile section
- Button calls the recap with current year data
- Visible during development, can be hidden via platform_config flag

**Production Mode (Year-End):**
- Automatically shows recap in late December/early January
- Only shows once per year (localStorage flag)
- Checks if patron has sufficient activity (at least 1 order or waitlist join)
- Can be dismissed and accessed later from Profile

**Year-End Trigger Logic:**
```
- Current date is between Dec 26 and Jan 7
- Patron hasn't seen recap for completed year
- Patron has at least 1 order OR 1 waitlist join in that year
```

### 5. Platform Config Flag (Optional)
Add to `platform_config` table:
- `feature.yearly_recap_enabled` - Master toggle
- `yearly_recap.test_mode` - Enables test button in Profile

### 6. Profile Section Integration
Add a "Your Year in Review" card to `ProfileSection.tsx`:
- Shows when recap is available
- "View My 2025 Recap" button
- Indicates if already viewed

---

## File Changes Summary

### New Files:
1. `src/components/YearlyRecap.tsx` - Main recap overlay component
2. `src/hooks/useYearlyRecap.ts` - Data fetching and state management
3. `supabase/functions/get-patron-yearly-recap/index.ts` - Edge function for stats

### Modified Files:
1. `src/pages/Index.tsx` - Add auto-trigger logic for year-end display
2. `src/components/ProfileSection.tsx` - Add "View Recap" button/card

---

## UI/UX Design Details

### Visual Style:
- Dark gradient background (black to deep purple/blue)
- Large, bold white typography
- Accent color highlights for numbers
- Subtle particle/confetti animations
- Smooth fade/scale transitions between slides

### Animations (using Framer Motion):
- Numbers count up from 0
- Text fades in with slight upward motion
- Venue name reveals with a slight delay
- Progress dots pulse on current slide

### Mobile-First:
- Full viewport height
- Touch-friendly tap zones
- Swipe gestures for navigation
- Safe area handling for notched devices

---

## Testing Plan

1. **Test Button:** During development, a "Preview Yearly Recap" button in Profile allows triggering the recap at any time with current year data.

2. **Empty State:** If patron has no activity, show a friendly "Start your journey!" message instead of stats.

3. **Edge Cases:**
   - New patron with only 1 order
   - Patron who only used waitlist (no orders)
   - Patron with no ratings given
   - Patron who visited only 1 venue

---

## Future Enhancements (Not in Initial Scope)
- Social sharing with generated image
- Comparison to previous year
- "Top X%" messaging (compared to other patrons)
- Push notification reminder to view recap
