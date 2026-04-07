

# Add Logo Upload to Merchant Signup + Logo Management in Merchant Settings

## Problem
1. The merchant signup wizard (Step 2: Venue Setup) has no logo upload field -- the dev dashboard has this but it was never ported to self-service signup.
2. MerchantSettings has no way for admins to view, update, or remove their venue logo after initial setup.

## Changes

### 1. MerchantSignup.tsx — Add logo upload to Venue Setup step (Step 2)
- Add state for `logoFile` (File | null) and `logoPreview` (string | null)
- Add a circular logo upload area with camera/upload icon, showing preview when selected
- Add the `LogoCropDialog` integration (already exists in the project) so merchants can crop their logo before upload
- After venue creation via `self-register-merchant`, upload the logo to the `venue-logos` bucket and update the venue's `logo_url` (same pattern as DevDashboard lines 425-445)

### 2. MerchantSettings.tsx — Add Logo Management section
- Add a new "Venue Branding" or "Venue Logo" accordion item at the top of settings
- Show the current logo (using `VenueLogo` component) or a placeholder
- "Change Logo" button triggers file picker + `LogoCropDialog`
- On confirm: upload to `venue-logos` bucket, update `logo_url` on the venue row with cache-buster
- "Remove Logo" button to clear `logo_url`
- Needs to fetch current `logo_url` from the venue — check if it's already available via props or needs a query

### 3. self-register-merchant edge function
- Already accepts `logoUrl` parameter and stores it — no changes needed to the function itself
- However, the logo upload must happen client-side (to `venue-logos` bucket) after venue creation, then update `logo_url` via a direct Supabase update — same as dev dashboard pattern

## Technical Details

**Signup logo flow:**
- File input accepts `image/*`
- On file select, read as data URL for preview, open `LogoCropDialog`
- On crop complete, store the resulting Blob as `logoFile`
- After `self-register-merchant` returns `venueId`, upload blob to `venue-logos/{venueId}.png` and update venue row

**Settings logo flow:**
- Fetch venue `logo_url` (may need to add it to the existing venue query in MerchantDashboard and pass as prop, or query directly in MerchantSettings)
- Same crop + upload + cache-buster pattern as DevDashboard

## Files Modified
| File | Change |
|------|--------|
| `src/pages/MerchantSignup.tsx` | Add logo upload UI + crop dialog + post-creation upload logic |
| `src/components/merchant/MerchantSettings.tsx` | Add "Venue Logo" section with view/change/remove |

No database or edge function changes needed — the `venue-logos` bucket and `logo_url` column already exist.

