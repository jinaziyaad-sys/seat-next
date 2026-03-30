

# Fix Promo Banner: Live Preview in Admin + Fix CTA Navigation

## Problems
1. **CTA "Learn More" just goes to table-ready tab** — `onNavigateToVenue` in Index.tsx ignores the venue ID and does `setActiveTab("table-ready")` instead of navigating to the venue
2. **No live preview in admin** — when creating a campaign, admins can't see how the banner will actually look on the patron side (with text overlay, gradient, etc.)

## Plan

### 1. Fix CTA navigation to open venue in Explore
**File**: `src/pages/Index.tsx`
- Change the `onNavigateToVenue` callback on the home PromoBanner to switch to the explore tab and pass the venue ID so ExploreVenues can auto-select/highlight that venue
- Add state like `selectedPromoVenueId` that gets passed to ExploreVenues, which triggers auto-selection of that venue

**File**: `src/components/ExploreVenues.tsx`
- Accept an optional `initialVenueId` prop
- When set, auto-scroll to and select that venue on mount

### 2. Add live banner preview in PromotionsManager
**File**: `src/components/dev/PromotionsManager.tsx`
- Below the image upload section, render a live preview card that mirrors exactly how `PromoBanner` displays the campaign on the patron side
- Shows the banner image with gradient overlay, title text positioned at the bottom, description, venue logo/name, CTA button, and "Sponsored" badge
- Updates in real-time as the admin types title/description/CTA text or uploads an image
- Label it "Preview — how patrons will see this banner"

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Fix `onNavigateToVenue` to pass venue ID and switch to explore tab |
| `src/components/ExploreVenues.tsx` | Accept `initialVenueId` prop, auto-select that venue |
| `src/components/dev/PromotionsManager.tsx` | Add live banner preview section in the campaign form |

