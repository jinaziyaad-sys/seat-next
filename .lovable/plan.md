

# Fix Promo Banners & Enhance Campaign Management

## Problems
1. **Banner image too small** — fixed `h-32` (128px) height cuts off images
2. **No image cropping** — uploads go straight to storage without adjustment
3. **No date/time scheduling** — no start/end date pickers in the campaign form
4. **No terminate option** — can only toggle active/delete, no formal "end campaign" action
5. **Ended campaigns clutter the list** — completed/terminated campaigns stay visible alongside active ones

## Plan

### 1. Increase banner image height in PromoBanner
**File**: `src/components/PromoBanner.tsx`
- Change the banner image container from `h-32` to `h-44` (176px) for better visibility
- Also increase the preview in PromotionsManager from `h-32` to `h-40`

### 2. Add image cropping via LogoCropDialog
**File**: `src/components/dev/PromotionsManager.tsx`
- Reuse the existing `LogoCropDialog` component (already in the project) but adapt the aspect ratio — promo banners need a 16:9 crop instead of 1:1
- Create a `BannerCropDialog` variant or pass aspect ratio prop
- Flow: user selects file → crop dialog opens → user adjusts → cropped blob uploads to storage

Since `LogoCropDialog` is hardcoded to `aspect={1}` and `cropShape="round"`, I'll create a lightweight `BannerCropDialog` component that uses `aspect={16/9}` and `cropShape="rect"`, reusing the same `react-easy-crop` library and crop utility function.

**New file**: `src/components/BannerCropDialog.tsx`

### 3. Add date/time scheduling to campaign form
**File**: `src/components/dev/PromotionsManager.tsx`
- Add `start_date` and `end_date` date pickers using Popover + Calendar pattern
- Add optional time inputs (hour selectors) for start and end
- Update form state and save logic to include these fields
- The `promo_campaigns` table already has `start_date` and `end_date` columns

### 4. Add "Terminate" action + archive completed campaigns
**File**: `src/components/dev/PromotionsManager.tsx`
- Add a "Terminate" button on active campaigns that sets `is_active = false` and `end_date = now()`
- Split the campaign list into two sections: "Active Campaigns" and "Completed/Terminated" (collapsed by default)
- Completed = `is_active = false` OR `end_date < now()`
- Remove the delete button from active campaigns (only terminate); keep delete on archived ones
- The `fetchData` query already fetches all campaigns (the super admin ALL policy allows it)

### 5. Fix PromoBanner date filtering
**File**: `src/components/PromoBanner.tsx`
- Add `.lte("start_date", new Date().toISOString())` to the query so future-scheduled campaigns don't show early
- The `end_date` filter is already handled by RLS policy

## Files Changed

| File | Change |
|------|--------|
| `src/components/BannerCropDialog.tsx` | New — 16:9 rectangular crop dialog for banner images |
| `src/components/dev/PromotionsManager.tsx` | Add crop on upload, date/time pickers, terminate button, active/archived split |
| `src/components/PromoBanner.tsx` | Increase image height, add start_date filter |

