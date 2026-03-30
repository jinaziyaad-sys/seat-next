

# Improve Promotional Banner System

## Current Issues

1. **No image upload** — the banner image field is just a URL text input. There's no file upload to Supabase Storage, so admins must host images externally.
2. **CTA click opens external URL** — `window.open(cta_link, "_blank")` opens whatever URL the admin typed. There's no in-app action (like navigating to the venue's page in Explore).
3. **Carousel works but is basic** — multiple active campaigns auto-rotate every 5 seconds with dot indicators. No swipe support.
4. **No storage bucket** for promo banner images exists yet.

## Plan

### 1. Create `promo-banners` storage bucket (migration)

New migration to create a public bucket for banner images with appropriate RLS policies (super admins can upload, anyone can read).

### 2. Add image upload to PromotionsManager

**File**: `src/components/dev/PromotionsManager.tsx`

- Replace the "Banner Image URL" text input with a file upload input
- On file select, upload to `promo-banners` bucket, get public URL, set it on the form
- Show image preview when a URL exists
- Keep the URL field as a fallback (some admins may want to paste an external URL)

### 3. Improve CTA click behavior — navigate to venue in-app

**File**: `src/components/PromoBanner.tsx`

- When `cta_link` is empty or not set, clicking the CTA (or the whole banner) navigates the patron to that venue in the Explore tab (switch to explore tab and highlight the venue)
- When `cta_link` is a URL, keep the current `window.open` behavior
- Track clicks in both cases

### 4. Add swipe support to carousel

**File**: `src/components/PromoBanner.tsx`

- Add touch event handlers (`onTouchStart`, `onTouchEnd`) for swipe left/right to change slides on mobile
- Pause auto-rotation when user interacts, resume after 8 seconds of inactivity

## Files Changed

| File | Change |
|------|--------|
| New migration | Create `promo-banners` public storage bucket + RLS policies |
| `src/components/dev/PromotionsManager.tsx` | Add file upload input for banner images, image preview |
| `src/components/PromoBanner.tsx` | Add swipe support, improve CTA click to navigate to venue in-app when no external link |

