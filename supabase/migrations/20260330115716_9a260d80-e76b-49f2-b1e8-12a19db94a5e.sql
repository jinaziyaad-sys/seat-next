
-- Create promo-banners storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read promo banner images
CREATE POLICY "Anyone can view promo banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'promo-banners');

-- Allow super admins to upload promo banner images
CREATE POLICY "Super admins can upload promo banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'promo-banners'
  AND public.is_super_admin(auth.uid())
);

-- Allow super admins to delete promo banner images
CREATE POLICY "Super admins can delete promo banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'promo-banners'
  AND public.is_super_admin(auth.uid())
);

-- Allow super admins to update promo banner images
CREATE POLICY "Super admins can update promo banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'promo-banners'
  AND public.is_super_admin(auth.uid())
);
