

# Add "Back to Home" Navigation from Inner Pages

## Problem
The global `Header` component is hidden on `/app`, `/`, `/merchant/dashboard`, and `/dev/dashboard`. Once a user clicks "Get Started" on the landing page and lands on `/app` or `/auth`, there's no way to navigate back to the landing page.

## Solution
Two changes to restore navigation:

### 1. Show the Header on `/app` with a home link
Update `Header.tsx` to no longer hide on `/app`. The logo click will navigate to `/` (landing page) when on patron routes, giving users a clear way back.

### 2. Add logo/back link on the Auth page
The Auth page (`/auth`) also needs a way back. The Header currently shows on `/auth` but navigates to `/app` — change it to navigate to `/` (landing) for unauthenticated pages like `/auth`.

### Technical Details

**`src/components/Header.tsx`**:
- Remove `isApp` from the hide condition (line 15), so the header shows on `/app`
- Update `getHomeRoute()`: for patron routes, return `/` instead of `/app` so clicking the logo goes back to the landing page

This gives every non-dashboard page a persistent header with a logo that links back to the landing page.

