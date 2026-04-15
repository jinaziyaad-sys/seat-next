
-- Allow venue staff to upload promo banners
CREATE POLICY "Venue staff can upload promo banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'promo-banners'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Venue staff can update promo banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'promo-banners'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Venue staff can delete promo banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'promo-banners'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Fix payment_status CHECK constraint to include 'refunded'
ALTER TABLE public.promo_campaigns
DROP CONSTRAINT IF EXISTS promo_campaigns_payment_status_check;

ALTER TABLE public.promo_campaigns
ADD CONSTRAINT promo_campaigns_payment_status_check
CHECK (payment_status IN ('paid', 'pending', 'comp', 'refunded'));
