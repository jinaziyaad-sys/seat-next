

# Next Phase: Feature Gating + Merchant Billing Page

The most impactful next steps are (A) enforcing subscriptions so the merchant dashboard actually requires a paid plan, and (B) giving merchants a way to manage their subscription after checkout.

---

## Part A: Feature Gating & Lockout Overlay

### MerchantDashboard changes
- Import `useMerchantSubscription` hook
- If `status` is `none`, `locked`, or `cancelled`, render a full-screen paywall overlay instead of the dashboard
  - Message: "Subscribe to access your dashboard"
  - CTA button linking to `/merchant/signup`
  - If `past_due`: show "Update your payment method" linking to Stripe portal
- For individual tabs/features (loyalty, analytics, kitchen board), check `hasFeature()` and show upgrade prompts for locked features

### Database: `merchant_subscriptions` table
- Create migration for `merchant_subscriptions` table to persist subscription state locally (venue_id, stripe_subscription_id, stripe_customer_id, status, plan tier, period dates)
- This allows the dev dashboard to query subscriptions without hitting Stripe every time
- Synced via `check-subscription` edge function (write-through on check)

## Part B: Merchant Billing Page

### New page: `/merchant/billing`
- Show current plan name, status, next billing date
- "Change Plan" button -> redirects to `/merchant/signup` with current plan highlighted
- "Manage Payment Method" button -> calls `customer-portal` edge function
- "Cancel Subscription" section with confirmation dialog
- Invoice history (once invoices table exists)

### Route setup
- Add `/merchant/billing` route in `App.tsx`
- Add "Billing" link in merchant settings or dashboard nav

## Part C: Dev Billing Dashboard (foundation)

### New tab in DevDashboard: "Billing"
- Sub-component: `src/components/dev/BillingDashboard.tsx`
- Lists all venues with subscription status (queries `merchant_subscriptions` table)
- Quick actions: manually activate/deactivate, apply free subscription override
- Basic MRR calculation from active subscriptions

### Database: `dev_pricing_overrides` table
- Migration for overrides table (venue_id, override_type, reason, expires_at)
- Dev can mark specific venues as "free" or apply discount

---

## Files to create/modify

| File | Action |
|---|---|
| New migration | `merchant_subscriptions` + `dev_pricing_overrides` tables with RLS |
| `supabase/functions/check-subscription/index.ts` | Update to write-through subscription state to DB |
| `src/pages/MerchantDashboard.tsx` | Add paywall overlay + per-feature gating |
| `src/pages/MerchantBilling.tsx` | New billing management page |
| `src/components/dev/BillingDashboard.tsx` | New dev billing tab |
| `src/pages/DevDashboard.tsx` | Add Billing tab |
| `src/App.tsx` | Add `/merchant/billing` route |

## Build order
1. Database migration (merchant_subscriptions, dev_pricing_overrides)
2. Update check-subscription to sync to DB
3. Feature gating on MerchantDashboard
4. Merchant billing page
5. Dev billing dashboard foundation

