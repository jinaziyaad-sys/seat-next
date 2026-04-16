

# Display the Venue QR Code in the Merchant Dashboard

## Problem
The `VenueQRCode` component exists in `src/components/merchant/VenueQRCode.tsx` but is never imported or rendered anywhere — it's completely orphaned. Merchants have no way to see or download their waitlist QR code.

## Solution
Add the QR code to the **Waitlist tab** in the merchant dashboard, displayed alongside the `WaitlistBoard`. This is the most logical placement since the QR code is specifically for waitlist join.

## Changes

**1. `src/pages/MerchantDashboard.tsx`**
- Import `VenueQRCode` from `@/components/merchant/VenueQRCode`
- In the waitlist `TabsContent`, wrap the existing `WaitlistBoard` and the new `VenueQRCode` in a layout that places the QR card in a sidebar or collapsible section beside the board

The QR code card already includes the venue name, a download button, and the scannable code — no changes needed to the component itself.

