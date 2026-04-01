# ReadyUp Platform — Feature Gap Analysis & Roadmap

Based on a thorough review of the entire codebase across all three portals (Patron, Merchant, Dev/Super Admin), here is a comprehensive list of what's missing, what can be improved, and new features worth adding.

---

## A. Patron App Gaps



### 6. Social Features

- No ability to invite friends to join a waitlist together
- No sharing of venue experiences or reviews publicly
- No "friends at this venue" indicator

### 7. Multi-Language Support (i18n)

The entire app is English-only. For a South African audience, Afrikaans and other languages would broaden reach.

### 8. Offline / Poor Connectivity Handling

No service worker or PWA manifest for offline support. If a patron loses signal while at a venue, they lose all tracking.

---

## B. Merchant Dashboard Gaps



### 11. Table Management (Live Floor Plan)

`TableConfigurationManager` lets merchants define tables, but there's no **live floor plan view** showing which tables are occupied, available, or reserved in real-time.

C. Dev / Platform Gaps

### 19. Audit Log

`ai_operations_log` exists but there's no general audit trail for admin actions (venue creation, role changes, config updates, data deletions).

### 20. System Health Dashboard

`VenueHealthReport` exists per-venue but there's no platform-wide system health view (edge function latency, error rates, database load, active users).

### 21. A/B Testing Framework

Feature flags exist as on/off toggles but there's no percentage rollout, user segmentation, or experiment tracking.

### 22. Automated Alerting

No automated alerts when error rates spike, venues go inactive, or system metrics cross thresholds.

---

## D. Cross-Cutting / Technical

### 23. PWA / Installable App

No `manifest.json`, no service worker. Adding PWA support would let patrons "install" the app on their home screen with push notifications.

### 24. Email Notifications

SMS OTP exists, push notifications exist, but there are **no email notifications** (order confirmations, waitlist updates, marketing).

### 25. Rate Limiting on Client

No client-side throttling on API calls. Rapid tapping could flood Supabase.

### 26. Accessibility (a11y)

No ARIA labels on interactive elements, no keyboard navigation testing, no screen reader support verified.

### 27. End-to-End Testing

No test files exist in the project. No Cypress, Playwright, or Vitest tests.

### 28. Data Retention / POPIA Compliance

For South African users, POPIA (Protection of Personal Information Act) compliance is needed. No data export, data deletion request flow, or privacy policy integration exists.

---

