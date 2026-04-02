

# Batch 4: Social Features, i18n, Offline Support

## 2. Social Features

### 2A. Invite Friends to Waitlist
- Add "Invite Friends" button on the waitlist tracking card (Index.tsx, when user has an active waitlist entry)
- Uses Web Share API (`navigator.share`) to share a deep link: `/waitlist/{venueId}?group={entryId}`
- On `WaitlistJoin.tsx`, detect `group` query param and link new entry to original via a `group_id` column on `waitlist_entries`
- **Migration**: Add `group_id uuid` (nullable, self-referencing) to `waitlist_entries` so grouped parties can be tracked together
- Merchant WaitlistBoard shows grouped entries with a visual indicator (e.g. chain icon)

### 2B. Share Venue Experience
- Add a "Share" button on venue cards in ExploreVenues and on the rating completion screen (RatingDialog)
- Uses Web Share API with venue name, rating, and deep link to `/waitlist/{venueId}`
- No database changes — purely client-side sharing

### 2C. Friends at This Venue
- **Migration**: New `patron_checkins` table (`user_id`, `venue_id`, `checked_in_at`, `expires_at`)
- Auto-create a check-in when a patron joins a waitlist or places an order (DB trigger)
- Auto-expire after 3 hours
- On ExploreVenues venue cards: query `patron_checkins` for the current user's friends (uses a new `patron_connections` table: `user_id`, `friend_id`, `status`)
- Show "2 friends here" badge on venue cards when matches found
- **New component**: `FriendsAtVenue.tsx` — small avatar row shown on venue detail

### 2D. Friend Connections
- **Migration**: `patron_connections` table (`id`, `user_id`, `friend_id`, `status` enum: pending/accepted/blocked, `created_at`)
- RLS: users can read/write their own connections
- Profile section: "Friends" sub-section to view connections and share invite link
- Accept/decline flow via in-app notification or deep link

---

## 3. Multi-Language (i18n)

### Approach
- Use `react-i18next` with JSON translation files
- Start with **English** (default) and **Afrikaans** as first additional language
- Scope to patron-facing UI only (merchant/dev dashboards stay English)

### Implementation
- Install `react-i18next` and `i18next`
- Create `src/i18n/` directory with `en.json`, `af.json` translation files
- Initialize i18n in `main.tsx`
- Add language switcher to ProfileSection (dropdown: English / Afrikaans)
- Store preference in `profiles.preferred_language` column (new migration)
- Wrap all patron-facing static strings in `t()` calls across:
  - `TabNavigation`, `Index` (home tab text), `WaitlistJoin` (form labels/buttons)
  - `FoodReadyFlow`, `TableReadyFlow` (status messages)
  - `ExploreVenues` (filter labels, empty states)
  - `ProfileSection` (section headers)
- **Migration**: Add `preferred_language text default 'en'` to `profiles`

### Translation scope (Phase 1)
- ~100 strings across patron pages
- Navigation labels, button text, status messages, form labels, toasts
- Dynamic content (venue names, menu items) stays untranslated

---

## 4. Offline / Poor Connectivity

### 4A. Offline Detection & UI
- **New component**: `src/components/OfflineIndicator.tsx`
- Listens to `navigator.onLine` and `online`/`offline` events
- Shows a persistent banner at top of screen: "You're offline — some features may be unavailable"
- Auto-dismisses when connection returns

### 4B. Action Queue for Critical Mutations
- **New utility**: `src/utils/offlineQueue.ts`
- When offline, queue mutations (join waitlist, send message, place order) in `localStorage`
- On reconnect, replay queued actions in order
- Show toast: "Back online — syncing X pending actions..."
- Wrap key Supabase calls in `Messenger.tsx`, `WaitlistJoin.tsx` with the queue

### 4C. Cache Active Tracking Data
- Already have Workbox `NetworkFirst` for Supabase API — this handles read caching
- Add `StaleWhileRevalidate` strategy for venue data (logos, venue list) in `vite.config.ts`
- Cache the user's active orders and waitlist entries in `localStorage` on each successful fetch in `Index.tsx`
- Display cached data immediately on load, then update when network responds
- Show subtle "Last updated X min ago" indicator when displaying cached data

---

## Files Summary

| File | Change |
|------|--------|
| New migration | `patron_connections`, `patron_checkins` tables; `group_id` on `waitlist_entries`; `preferred_language` on `profiles`; auto-checkin trigger |
| `src/i18n/en.json` | New — English translations |
| `src/i18n/af.json` | New — Afrikaans translations |
| `src/i18n/index.ts` | New — i18next init |
| `src/main.tsx` | Import i18n init |
| `src/components/OfflineIndicator.tsx` | New — offline banner |
| `src/utils/offlineQueue.ts` | New — localStorage action queue |
| `src/components/FriendsAtVenue.tsx` | New — friends-at-venue badge |
| `src/pages/Index.tsx` | Add share/invite button on waitlist card; cache tracking data; i18n `t()` calls |
| `src/pages/WaitlistJoin.tsx` | Handle `group` param; i18n strings |
| `src/components/ExploreVenues.tsx` | Share button; friends badge; i18n |
| `src/components/RatingDialog.tsx` | Share after rating |
| `src/components/TabNavigation.tsx` | i18n labels |
| `src/components/ProfileSection.tsx` | Language switcher; friends section |
| `src/components/FoodReadyFlow.tsx` | i18n status strings |
| `src/components/TableReadyFlow.tsx` | i18n status strings |
| `src/components/Messenger.tsx` | Offline queue wrapper |
| `src/App.tsx` | Add OfflineIndicator |
| `vite.config.ts` | Add StaleWhileRevalidate cache strategy for venue assets |
| `package.json` | Add `react-i18next`, `i18next` |

## Build Order
1. Offline indicator + queue (foundational, improves resilience for everything else)
2. i18n setup + language switcher + translate patron strings
3. Social: share venue, invite to waitlist, friend connections, friends-at-venue

