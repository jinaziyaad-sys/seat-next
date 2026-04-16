

# Enable Public Waitlist Join via QR Code Scan

## What This Does
Patrons scan a venue's QR code with their phone camera and land on a page where they can join that restaurant's waitlist — entering their name, party size, and seating preferences.

## Current State
- `WaitlistJoin.tsx` page already exists with full functionality (name, phone, party size, preferences, busyness indicator)
- `VenueQRCode.tsx` already generates QR codes pointing to `/waitlist/{venueId}`
- The route is simply **not registered** in `App.tsx`

## Changes

**1. `src/App.tsx`** — Add the missing route
- Import `WaitlistJoin` from `src/pages/WaitlistJoin`
- Add `<Route path="/waitlist/:venueId" element={<WaitlistJoin />} />` before the catch-all

That's it — one file, two lines. The page and QR code generation are already built and functional.

## How It Works
1. Merchant displays the QR code (already available in their dashboard via `VenueQRCode`)
2. Patron scans it with their phone camera
3. Browser opens `/waitlist/{venueId}`
4. Patron sees the venue name, busyness level, and a form to join
5. After submitting, they're redirected to `/app` to track their position

