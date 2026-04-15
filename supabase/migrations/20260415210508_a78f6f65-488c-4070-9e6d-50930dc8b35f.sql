
-- Client logos table for landing page
CREATE TABLE public.client_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  website_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_logos ENABLE ROW LEVEL SECURITY;

-- Anyone can view active logos (public landing page)
CREATE POLICY "Anyone can view active client logos"
  ON public.client_logos FOR SELECT
  USING (is_active = true);

-- Super admins can manage logos
CREATE POLICY "Super admins can manage client logos"
  ON public.client_logos FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Storage bucket for client logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow super admins to upload
CREATE POLICY "Super admins can upload client logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-logos' AND is_super_admin(auth.uid()));

-- Allow super admins to delete
CREATE POLICY "Super admins can delete client logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-logos' AND is_super_admin(auth.uid()));

-- Public read for client logos
CREATE POLICY "Anyone can view client logo files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-logos');
