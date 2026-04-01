
-- Create a separate server-only table for verification codes
CREATE TABLE public.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS but add NO select policies for regular users
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (service role bypasses RLS)
-- No policies = no client access

-- Remove verification columns from profiles (keep phone_verified, phone, etc.)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_code;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_code_expires_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_attempts;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_verification_sent_at;

-- Update cleanup function to use new table
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.verification_codes
  WHERE expires_at < NOW();
END;
$$;
