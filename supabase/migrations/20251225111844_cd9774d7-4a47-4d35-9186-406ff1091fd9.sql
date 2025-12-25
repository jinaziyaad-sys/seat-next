-- Create storage bucket for issue screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-screenshots', 'issue-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload screenshots (they're submitting issues)
CREATE POLICY "Anyone can upload issue screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'issue-screenshots');

-- Allow public read access for screenshots
CREATE POLICY "Anyone can view issue screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'issue-screenshots');

-- Add screenshot_url column to platform_errors
ALTER TABLE public.platform_errors
ADD COLUMN IF NOT EXISTS screenshot_url text;