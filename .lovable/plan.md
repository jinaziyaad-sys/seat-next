

## Unified Authentication Plan

### The Problem
Currently there are 3 separate auth pages (`/auth`, `/merchant/auth`, `/dev/auth`) with duplicated logic. Users who are both patrons and merchants need separate login flows.

### The Solution: One Sign-In, Smart Routing

**Single unified `/auth` page** with Sign In + Sign Up tabs (no sign-up for dev — that's handled by role assignment in the backend). After authentication, a **role-based router** checks the user's `user_roles` and sends them to the right place.

### How Multi-Role Users Work (e.g., patron + merchant)

After sign-in, if a user has multiple roles, they see a **clean role picker screen** — not a complex dialog, just simple cards:

```text
┌─────────────────────────────┐
│       Welcome back, Sam     │
│                             │
│  ┌───────────┐ ┌──────────┐ │
│  │  🍽️       │ │  🏪      │ │
│  │  Patron   │ │ Merchant │ │
│  │  View     │ │ Dashboard│ │
│  └───────────┘ └──────────┘ │
│                             │
│  Remember my choice ☐       │
└─────────────────────────────┘
```

If they only have one role (or no roles = patron), they go straight through with no picker.

### Implementation Steps

1. **Create a unified `/auth` page** that replaces all three auth pages
   - Keep the existing Sign In / Sign Up tabs from the patron auth
   - Keep Google OAuth, phone verification, email verification — all existing flows
   - Remove the merchant-specific "Create a New Venue Account" button and replace with a subtle link or integrate the merchant signup flow separately
   - Remove the dev-specific branding — dev users just sign in with the same form

2. **Build a post-login role router** (new component `RoleRouter.tsx`)
   - After successful auth, query `user_roles` for the user
   - No roles → patron → route to `/`
   - Only `staff`/`admin` roles → route to `/merchant/dashboard`
   - Only `super_admin` → route to `/dev/dashboard`
   - Multiple role types → show the role picker
   - If "remember my choice" was set, skip the picker next time (stored in localStorage, clearable from profile)

3. **Update route guards** (`useAuth`, `useMerchantAuth`, `useDevAuth`)
   - Remove the redirects to separate auth pages — all redirect to `/auth` instead
   - Keep the role validation logic in each guard

4. **Update `App.tsx` routes**
   - Keep `/merchant/auth` and `/dev/auth` as redirects to `/auth` for backward compatibility
   - Remove `MerchantAuth` and `DevAuth` page imports once unified

5. **Keep merchant signup separate** at `/merchant/signup`
   - The "Create a New Venue" flow stays as-is — it's an onboarding wizard, not auth
   - Add a small link on the unified auth page: "Want to list your restaurant? Create a venue account"

### Technical Details

**Role query after login:**
```typescript
const { data: roles } = await supabase
  .from("user_roles")
  .select("role, venue_id, venues(name)")
  .eq("user_id", user.id);

const roleTypes = new Set(roles?.map(r => r.role));
const isSuperAdmin = roleTypes.has("super_admin");
const isMerchant = roleTypes.has("staff") || roleTypes.has("admin");
const isPatron = !roles || roles.length === 0;
```

**Multi-venue merchant flow preserved:** If a merchant has multiple venues, they still see the venue picker on the merchant dashboard (existing `VenueSwitcher` component handles this).

**Files to modify:**
- `src/pages/Auth.tsx` — merge in merchant/dev sign-in logic, add post-login routing
- `src/pages/MerchantAuth.tsx` — convert to redirect to `/auth`
- `src/pages/DevAuth.tsx` — convert to redirect to `/auth`
- `src/hooks/useAuth.ts` — update redirect targets from `/merchant/auth` and `/dev/auth` to `/auth`
- `src/App.tsx` — update route definitions
- New: `src/components/RoleRouter.tsx` — role picker for multi-role users

