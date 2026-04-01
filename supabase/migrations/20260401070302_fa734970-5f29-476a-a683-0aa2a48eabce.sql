-- Fix recursive RLS on user_roles
DROP POLICY IF EXISTS "Staff can view venue roles" ON public.user_roles;

CREATE POLICY "Staff can view venue roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  venue_id = public.get_user_venue(auth.uid())
  OR user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- Fix recursive RLS on snapshot tables
DROP POLICY IF EXISTS "Staff can insert venue capacity snapshots" ON public.venue_capacity_snapshots;
DROP POLICY IF EXISTS "Staff can insert daily snapshots" ON public.daily_venue_snapshots;

CREATE POLICY "Staff can insert venue capacity snapshots"
ON public.venue_capacity_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  venue_id = public.get_user_venue(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Staff can insert daily snapshots"
ON public.daily_venue_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  venue_id = public.get_user_venue(auth.uid())
  OR public.is_super_admin(auth.uid())
);