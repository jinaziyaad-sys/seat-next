-- Create password_reset_requests table
CREATE TABLE public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  venue_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'dismissed'))
);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view/manage reset requests
CREATE POLICY "Super admins can manage password reset requests"
ON public.password_reset_requests
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Allow public insert for reset requests (no auth needed)
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);