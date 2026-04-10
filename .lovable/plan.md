

## Audit: Routes & Pages

Here is the full picture of every route and whether it is still needed:

| Route | Page | Verdict |
|---|---|---|
| `/auth` | `Auth.tsx` — unified sign-in/sign-up + RoleRouter | **Keep** — the single entry point |
| `/merchant/auth` | `MerchantAuth.tsx` — redirects to `/auth` | **Keep as redirect** for backward compat (bookmarks, old links) |
| `/dev/auth` | `DevAuth.tsx` — redirects to `/auth` | **Keep as redirect** for same reason |
| `/` | `Index.tsx` — patron app | **Keep** |
| `/merchant/dashboard` | `MerchantDashboard.tsx` | **Keep** |
| `/merchant/signup` | `MerchantSignup.tsx` — venue onboarding wizard | **Keep** — linked from auth page |
| `/merchant/billing` | `MerchantBilling.tsx` — billing/invoices | **Keep** — accessed from merchant dashboard settings |
| `/dev/dashboard` | `DevDashboard.tsx` | **Keep** |
| `/waitlist/:venueId` | `WaitlistJoin.tsx` — public QR code entry | **Keep** — public, no auth needed |
| `/privacy` | `Privacy.tsx` | **Keep** |
| `*` | `NotFound.tsx` | **Keep** |

### Are all pages reachable without the URL bar?

- `/merchant/billing` — accessed from the merchant dashboard (Settings or header link). Reachable.
- `/merchant/signup` — linked from the unified auth page ("Want to list your restaurant?"). Reachable.
- `/waitlist/:venueId` — accessed via QR codes at venues. Reachable.
- `/privacy` — needs to be linked from somewhere (profile, auth page footer, etc.). **Currently only reachable if you know the URL.**

### What needs fixing

1. **Privacy page link** — add a small "Privacy Policy" link to the auth page footer and/or the patron profile section so users can find it without typing the URL.

That is the only gap. Everything else is properly wired into the workflow through the RoleRouter, dashboard navigation, and existing links. No pages need to be removed.

### Implementation

1. Add a "Privacy Policy" text link at the bottom of the auth page (`Auth.tsx`)
2. Optionally add it to the patron profile section as well

This is a small change — just a link or two.

