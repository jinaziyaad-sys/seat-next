

# Add Venue Logo Support

## Overview

Add the ability for developers to upload a restaurant logo when creating/editing venues. The logo will display across the patron dashboard (venue search, explore, tracking cards) and the merchant dashboard (header, venue switcher).

## Current State

- The `venues` table has no `logo_url` column
- Venue creation in `DevDashboard.tsx` collects name, address, phone, service types — no logo
- No storage bucket exists for venue logos
- Venue cards in `ExploreVenues.tsx`, `TableReadyFlow.tsx`, `FoodReadyFlow.tsx`, and `MerchantDashboard.tsx` show only text — no image

## Changes

### 1. Database Migration

- Add `logo_url TEXT` column to `venues` table
- Create a `venue-logos` public storage bucket
- Add RLS policies: anyone can read, authenticated admins/super_admins can upload

```sql
ALTER TABLE public.venues ADD COLUMN logo_url text;

INSERT INTO storage.buckets (id, name, public) VALUES ('venue-logos', 'venue-logos', true);

CREATE POLICY "Anyone can view venue logos"
ON storage.objects FOR SELECT USING (bucket_id = 'venue-logos');

CREATE POLICY "Authenticated users can upload venue logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'venue-logos');

CREATE POLICY "Authenticated users can update venue logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'venue-logos');
```

### 2. Dev Dashboard — Logo Upload on Create & Edit

**File: `src/pages/DevDashboard.tsx`**

- Add a file input / image preview in the "Create Venue" form
- On submit: upload image to `venue-logos/{venueId}.{ext}`, get public URL, save to `logo_url`
- Same for the "Edit Venue" dialog — show current logo, allow replacement

### 3. Patron-Facing Components — Display Logo

**Files:**
- `src/components/ExploreVenues.tsx` — Show logo in venue card (circular avatar, fallback to first letter of name)
- `src/components/TableReadyFlow.tsx` — Show logo in venue list when selecting a venue
- `src/components/FoodReadyFlow.tsx` — Show logo in venue list when selecting a venue
- `src/pages/Index.tsx` — Show logo in active tracking cards (waitlist/order entries)

Each will use the Avatar component with the logo URL and a letter-initial fallback.

### 4. Merchant-Facing Components — Display Logo

**Files:**
- `src/components/Header.tsx` or `src/pages/MerchantDashboard.tsx` — Show venue logo in the merchant dashboard header
- `src/components/merchant/VenueSwitcher.tsx` — Show logo next to venue name in the switcher dropdown

### 5. Shared Logo Component

Create a small reusable `VenueLogo` component:
```tsx
// src/components/VenueLogo.tsx
function VenueLogo({ logoUrl, name, size = "md" }) {
  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarImage src={logoUrl} alt={name} />
      <AvatarFallback>{name?.charAt(0)}</AvatarFallback>
    </Avatar>
  );
}
```

## Files Summary

| File | Change |
|------|--------|
| Migration SQL | Add `logo_url` column, create storage bucket |
| `src/components/VenueLogo.tsx` | New reusable logo avatar component |
| `src/pages/DevDashboard.tsx` | Add logo upload to create/edit venue forms |
| `src/components/ExploreVenues.tsx` | Show logo in venue cards |
| `src/components/TableReadyFlow.tsx` | Show logo in venue selection list |
| `src/components/FoodReadyFlow.tsx` | Show logo in venue selection list |
| `src/pages/Index.tsx` | Show logo in tracking cards |
| `src/pages/MerchantDashboard.tsx` | Show logo in merchant header |
| `src/components/merchant/VenueSwitcher.tsx` | Show logo in venue switcher |

