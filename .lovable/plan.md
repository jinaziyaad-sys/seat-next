

# Phased Feature Roadmap

You've selected everything — that's a lot of work. Here's a phased approach broken into manageable batches.

---

## Phase 1: Foundation & Compliance (build first)

### 1A. POPIA Compliance
- New migration: `data_deletion_requests` table (user_id, status, requested_at, completed_at)
- New edge function `request-data-export` — queries all user data across tables, returns JSON/CSV
- New edge function `request-data-deletion` — marks request, admin reviews in Dev dashboard
- Privacy Policy page at `/privacy` with POPIA-required disclosures
- Patron settings: "Download My Data" and "Request Account Deletion" buttons
- Dev dashboard: new "Data Requests" panel to review/action deletion requests

### 1B. Rate Limiting on Client
- Create `src/utils/rateLimiter.ts` — simple token bucket / debounce utility
- Wrap all critical mutation calls (join waitlist, place order, send message) with rate limiter
- Show toast "Please wait..." when rate limited

### 1C. PWA / Installable App
- Already has `vite-plugin-pwa` configured in `vite.config.ts` — need to add iframe/preview guard in `main.tsx`
- Add `navigateFallbackDenylist: [/^\/~oauth/]` to workbox config
- Add proper icons (192x192, 512x512) to `/public`
- Create `/install` page with install prompt trigger
- Add conditional SW registration guard (skip in iframe/preview hosts)

---

## Phase 2: Merchant Features

### 2A. Live Floor Plan
- New component `src/components/merchant/LiveFloorPlan.tsx`
- Query `waitlist_entries` (status: waiting/ready/seated) joined with table assignments
- Visual grid showing each configured table with status badge (Free / Occupied / Reserved)
- Color coding: green=free, amber=reserved, red=occupied
- Real-time updates via Supabase realtime subscription on `waitlist_entries`
- Add as a new tab or sub-view within the existing Reservations tab

---

## Phase 3: Dev Platform

### 3A. Audit Log
- New migration: `platform_audit_log` table (actor_id, action, entity_type, entity_id, details JSONB, created_at)
- New edge function wrapper or DB triggers on key tables: `venues`, `user_roles`, `loyalty_programs`, `feature_flags`
- Dev dashboard: new "Audit Log" tab with filterable table (by actor, action type, date range)

### 3B. System Health Dashboard
- New component in Dev dashboard showing:
  - Active users (count of profiles with recent activity)
  - Error rate trend from `platform_errors` table
  - Edge function invocation counts (from Supabase management API or manual logging)
  - Venue activity summary (active vs inactive venues)
- Queries existing tables — no new migrations needed initially

### 3C. A/B Testing Framework
- Extend `feature_flags` table: add `rollout_percentage` (integer 0-100), `user_segments` (JSONB)
- Update `usePlatformConfig` hook to evaluate percentage rollout using hash of user ID
- Dev dashboard: update FeatureFlagsPanel to show percentage slider and segment selector

### 3D. Automated Alerting
- New migration: `alert_rules` table (metric, threshold, comparison, notification_channel, is_active)
- Scheduled edge function `check-alert-thresholds` — runs on cron, queries `platform_errors`, venue activity
- Sends alerts via existing push notification or new email channel

---

## Phase 4: Communication & Accessibility

### 4A. Email Notifications
- New edge function `send-email-notification` using Supabase's built-in email or a provider (Resend/SendGrid)
- Trigger emails on: order ready, waitlist ready, reservation confirmed
- Patron settings: email notification preferences toggle
- Requires an email provider API key (will need to add secret)

### 4B. Accessibility (a11y)
- Audit pass across all interactive components:
  - Add `aria-label` to icon-only buttons
  - Add `role` attributes to custom widgets
  - Ensure all form inputs have associated labels
  - Add keyboard navigation to tab components, dialogs, dropdowns
  - Add skip-to-content link in Header
- Focus on patron-facing pages first (Index, WaitlistJoin, Auth)

### 4C. E2E Testing
- Add Vitest config (`vitest.config.ts`, `src/test/setup.ts`)
- Write unit tests for critical utilities: `rateLimiter`, `businessHours`, `geolocation`
- Write component tests for: Auth flow, WaitlistJoin form validation, KitchenBoard status transitions
- Add test script to `package.json`

---

## Recommended Build Order

| Priority | Feature | Effort |
|----------|---------|--------|
| 1 | PWA guard fix (already half-done) | Small |
| 2 | Rate Limiting utility | Small |
| 3 | POPIA Compliance | Medium |
| 4 | Live Floor Plan | Medium |
| 5 | Audit Log | Medium |
| 6 | System Health Dashboard | Medium |
| 7 | A/B Testing | Small |
| 8 | Email Notifications | Medium |
| 9 | Automated Alerting | Medium |
| 10 | Accessibility pass | Medium |
| 11 | E2E Testing | Medium |

I'd suggest we start with items 1-4 (PWA fix, Rate Limiting, POPIA, Live Floor Plan) as the first implementation batch. Approve to proceed, or tell me which subset you'd like to start with.

