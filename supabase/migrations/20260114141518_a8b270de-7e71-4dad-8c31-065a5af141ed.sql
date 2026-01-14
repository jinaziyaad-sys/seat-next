-- Fix storage bucket security: require authentication for uploads
-- and limit uploads to authenticated users only

-- Drop the overly permissive upload policy
DROP POLICY IF EXISTS "Anyone can upload issue screenshots" ON storage.objects;

-- Create a more restrictive policy that requires authentication
CREATE POLICY "Authenticated users can upload issue screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'issue-screenshots' 
  AND auth.uid() IS NOT NULL
);

-- Note: The existing SELECT policy "Anyone can view issue screenshots" is kept
-- because issue screenshots need to be viewable by super admins who review errors.
-- If stricter security is needed, consider using signed URLs instead.