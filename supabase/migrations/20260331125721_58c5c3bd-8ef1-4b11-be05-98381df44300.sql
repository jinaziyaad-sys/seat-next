
-- 1. Fix user_roles: Replace overly permissive SELECT with scoped policies
DROP POLICY IF EXISTS "Authenticated users can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;

-- Check for any USING(true) SELECT policy on user_roles and drop it
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'user_roles' AND schemaname = 'public' AND cmd = 'SELECT'
    AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

-- Users can read their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Staff can view roles for their venue
CREATE POLICY "Staff can view venue roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  venue_id IN (SELECT ur.venue_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
);

-- Super admins can view all roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2. Fix anonymous INSERT on snapshot tables
DROP POLICY IF EXISTS "System can insert capacity snapshots" ON public.venue_capacity_snapshots;
DROP POLICY IF EXISTS "System can insert snapshots" ON public.daily_venue_snapshots;

-- Service role bypasses RLS, so no INSERT policy needed for edge functions
-- If staff need to insert, add scoped policy:
CREATE POLICY "Staff can insert venue capacity snapshots"
ON public.venue_capacity_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (SELECT ur.venue_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Staff can insert daily snapshots"
ON public.daily_venue_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (SELECT ur.venue_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- 3. Make issue-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'issue-screenshots';

-- Update storage RLS: only super admins can view
DROP POLICY IF EXISTS "Anyone can view issue screenshots" ON storage.objects;

CREATE POLICY "Super admins can view issue screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'issue-screenshots'
  AND public.is_super_admin(auth.uid())
);
