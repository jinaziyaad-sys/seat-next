

# Promo System Fix Plan

## Issues Found

### 1. Images not showing
The `promo-banners` storage bucket only allows **super admins** to upload. When a merchant uploads a banner via SponsoredAdsManager, the upload silently fails because there's no storage policy for venue staff. The image URL gets set to a non-existent file path.

### 2. Promos not going live after payment
Two problems:
- **CHECK constraint**: The `payment_status` column has `CHECK (payment_status IN ('paid', 'pending', 'comp'))` but the webhook tries to set it to `'refunded'` in the refund flow (code references `refunded` status but the DB rejects it). More critically, the webhook correctly sets `payment_status = 'paid'` and then checks `review_status = 'approved'` to set `is_active = true` — this logic looks correct in the stripe-webhook. The likely issue is that the **webhook is not being called** because `STRIPE_WEBHOOK_SECRET` may not be configured, or the webhook endpoint URL isn't registered in Stripe.
- **RLS blocking the update**: The webhook uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS, so this should work. But the `payment_status` CHECK constraint doesn't include `'refunded'` — this would cause the refund edge function to fail silently.

### 3. How promos work / scalability concerns
Currently promos are **not location-based** — they show to ALL patrons based on placement (home/explore/tracking). The carousel rotates every 5 seconds through all active campaigns for that placement. With hundreds of promos, every patron loads ALL of them. No randomization, no geo-filtering, no fair rotation.

## Plan

### Step 1: Fix storage — allow merchants to upload banners
Add a migration with storage policies allowing venue staff (not just super admins) to upload to `promo-banners`.

### Step 2: Fix payment_status CHECK constraint
Add `'refunded'` to the allowed values so the refund flow doesn't break. This also ensures webhooks don't fail on edge cases.

### Step 3: Fix promo activation reliability
- Add a `cta_text` and `cta_link` column check — these exist in the schema but merchants can't set them in SponsoredAdsManager. Add CTA fields to the campaign creation form.
- Ensure the webhook endpoint is documented/configured correctly (user action — need to verify Stripe webhook URL is set).

### Step 4: Make promos scalable and fair for hundreds of campaigns
Modify `PromoBanner.tsx` to:
- **Limit query to 10 random campaigns** per placement instead of loading all — use `.limit(10)` and randomize on the server or shuffle client-side
- **Filter by end_date** — currently only checks `start_date <= now` but doesn't filter expired campaigns (the RLS policy does `end_date > now()` but the client query doesn't)
- **Add geo-awareness** (optional column `target_radius_km` and `target_lat/lng` on `promo_campaigns`) — for future use, not blocking

### Step 5: Add fair rotation logic
- Shuffle the fetched campaigns randomly so different patrons see different promos first
- Keep the 5-second auto-rotate carousel for the randomized subset
- This ensures with 100+ promos, each patron sees a fair random sample

### Files Changed
| File | Change |
|------|--------|
| New migration | Add storage policies for venue staff uploads to `promo-banners`; add `'refunded'` to payment_status CHECK |
| `src/components/PromoBanner.tsx` | Add end_date filter, limit to 10, shuffle results randomly |
| `src/components/merchant/SponsoredAdsManager.tsx` | Add CTA text/link fields to campaign creation form |
| `supabase/functions/stripe-webhook/index.ts` | No change needed — logic is correct |

### User Action Required
- Verify the Stripe webhook endpoint URL is configured in the Stripe dashboard pointing to `https://cuoqjgahpfymxqrdlzlf.supabase.co/functions/v1/stripe-webhook`
- Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase Edge Function secrets

