# Fix Billing Access, Remove Enterprise Tier, Enforce Feature Gating

## Issues Identified

1. **No billing link on merchant dashboard** — the `/merchant/billing` page exists but there's no navigation to it from the dashboard
  &nbsp;
2. **Features not actually gated by subscription** — the dashboard uses `usePlatformConfig` flags (dev-level) but never checks `subscription.hasFeature()`, so any subscribed merchant sees everything regardless of tier

## Changes



### 2. Add billing link to merchant dashboard

`**src/pages/MerchantDashboard.tsx**`

- Add a "Billing" button/link in the dashboard header (near the Logout button) that navigates to `/merchant/billing`
- Show current plan badge (e.g. "Starter" or "Pro") from `subscription.tierName`

### 3. Enforce subscription-based feature gating

`**src/pages/MerchantDashboard.tsx**`

- Change feature visibility to combine platform config AND subscription entitlements:
  - `hasAnalytics` → also requires `subscription.hasFeature('analytics')`
  - `hasLoyalty` (loyalty tab) → also requires `subscription.hasFeature('loyalty')`
- For locked features, show an upgrade prompt card instead of hiding the tab entirely (so merchants know what they're missing)
- Core features (kitchen, waitlist, reservations) remain visible for all subscribers



---

&nbsp;

1. Update `MerchantDashboard.tsx` — add billing link + enforce `hasFeature()` gating
2. Update `MerchantBilling.tsx` if needed for tier display consistency