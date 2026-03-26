
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
