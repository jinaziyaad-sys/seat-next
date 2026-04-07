

# Merchant Signup & Onboarding Wizard

## Problem
The current signup flow is minimal: a basic registration form (name, venue name, email, password) that immediately shows plan cards. There's no way for merchants to configure their requirements (loyalty, kitchen board, etc.), set up venue details (address, logo, contact info, staff), or understand what they're getting before paying. The dev dashboard has all this venue creation logic but it's not exposed to self-service merchants.

## Solution
Replace the current `MerchantSignup` page with a multi-step onboarding wizard that mirrors the dev venue creation process but is self-service.

### Step Flow (two valid paths)

```text
Path A: Browse → Register → Configure → Setup → Pay
Path B: Browse → Register → Pay → Configure → Setup

Step 1: Plan Selection (public, no auth required)
  - Show pricing tiers with feature breakdowns (existing UI)
  - Feature configurator: toggle which features matter (loyalty, kitchen, etc.)
  - Recommends a plan based on selections
  - CTA: "Get Started" → goes to Step 2

Step 2: Account Registration (if not logged in)
  - Email, password, full name
  - On submit: create auth user (supabase.auth.signUp)
  - No venue created yet

Step 3: Venue Setup
  - Venue name, phone, display address
  - Address validation + map (reuse validate-address function)
  - Logo upload (reuse venue-logos bucket)
  - Service types toggle (Food Ready, Table Ready)
  - Business hours (sensible defaults pre-filled)
  - On submit: insert into venues table + upload logo

Step 4: Admin Account Setup
  - Already created in Step 2 — this step assigns the admin role
  - Optionally add additional staff members
  - Creates user_role entries via create-merchant edge function

Step 5: Payment / Checkout
  - Show selected plan summary
  - Stripe checkout (existing create-checkout function)
  - On success: redirect to /merchant/dashboard

Alternative: user can pay first (Step 5 before Steps 3-4)
  - After payment, redirect to a "Complete Setup" flow
  - Dashboard detects incomplete setup and shows wizard
```

### Technical Details

**New/Modified Files:**

| File | Change |
|------|--------|
| `src/pages/MerchantSignup.tsx` | Full rewrite — multi-step wizard with 5 steps |
| `src/pages/MerchantAuth.tsx` | Add prominent "Sign Up" link/button |
| `supabase/migrations/...` | Add `onboarding_completed` boolean to `venues` table |
| `src/pages/MerchantDashboard.tsx` | Check `onboarding_completed` — if false, redirect to setup wizard |

**Step 1 — Plan Explorer** (no auth):
- Reuse existing plan-fetching logic from `subscription_plans` table
- Add interactive feature selector (checkboxes for loyalty, kitchen board, analytics, etc.)
- Highlight recommended plan based on selected features
- "Get Started" stores selected plan in component state

**Step 2 — Registration** (if not authenticated):
- Email, password, full name fields
- `supabase.auth.signUp()` with `emailRedirectTo`
- Auto-login after signup (Supabase returns session)

**Step 3 — Venue Setup**:
- Reuse venue creation logic from DevDashboard (address validation, logo upload, service types, default settings)
- Insert into `venues` table with `onboarding_completed: false`
- Upload logo to `venue-logos` bucket

**Step 4 — Admin Role Assignment**:
- Insert `user_roles` row: `{ user_id, venue_id, role: 'admin' }` using service role via a new lightweight edge function (`self-register-merchant`) since the existing `create-merchant` requires an existing admin to call it
- Optional: add staff email invites (stored for later)

**Step 5 — Payment**:
- Call `create-checkout` with selected plan's price ID and venue_id metadata
- On return from Stripe: update `venues.onboarding_completed = true`
- Redirect to dashboard

**New Edge Function: `self-register-merchant`**:
- Accepts: `{ venueName, address, phone, displayAddress, latitude, longitude, serviceTypes, logoUrl, settings }`
- Authenticates via JWT (gets user from token)
- Creates the venue row
- Assigns the calling user as `admin` in `user_roles`
- Returns `{ venueId }`
- This replaces the current `create-merchant` for self-service (which requires an existing admin)

**Migration**:
```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT true;
-- Default true so existing venues aren't affected
```

**Dashboard guard** in `MerchantDashboard.tsx`:
- After loading venue data, check `venueData.onboarding_completed`
- If false, show inline setup completion wizard or redirect to `/merchant/signup?complete=true`

### What Gets Removed
- The inline registration card currently embedded in plan selection
- Direct call to `create-merchant` from signup (replaced by `self-register-merchant`)

## Implementation Order
1. Migration: add `onboarding_completed` column
2. Edge function: `self-register-merchant`
3. Rewrite `MerchantSignup.tsx` as multi-step wizard
4. Update `MerchantAuth.tsx` with prominent signup link
5. Add dashboard guard for incomplete onboarding

