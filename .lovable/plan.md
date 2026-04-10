

## Plan: Hide Waitlist QR Code / Join Feature

The waitlist join page and QR code component are not functioning and should be hidden for now. The files stay in the codebase for a future build, but all user-facing access is removed.

### Changes

1. **`src/App.tsx`** — Remove the `/waitlist/:venueId` route and the `WaitlistJoin` import. The page file stays on disk but is unreachable.

2. **`src/components/merchant/VenueQRCode.tsx`** — No change needed. It's already not imported or rendered anywhere in the merchant dashboard. It just sits as dead code, ready for later use.

That's it — one file edit. The `WaitlistJoin.tsx` page and `VenueQRCode.tsx` component remain in the codebase untouched for when you're ready to build this out properly.

