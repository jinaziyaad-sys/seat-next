-- Add image_url and voucher_validity_days to loyalty_rewards
ALTER TABLE public.loyalty_rewards
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS voucher_validity_days integer DEFAULT 30;

-- Add expires_at to discount_codes
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Create storage bucket for reward images
INSERT INTO storage.buckets (id, name, public)
VALUES ('reward-images', 'reward-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload
CREATE POLICY "Authenticated users can upload reward images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reward-images');

-- Storage policy: anyone can view
CREATE POLICY "Anyone can view reward images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'reward-images');

-- Storage policy: authenticated users can delete reward images
CREATE POLICY "Authenticated users can delete reward images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reward-images');