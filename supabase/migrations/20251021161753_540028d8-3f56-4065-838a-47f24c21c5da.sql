-- Fix infinite recursion in user_roles RLS policies
-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can view venue roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert venue roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete venue roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create simple non-recursive policies
-- Allow all authenticated users to read roles (no recursion)
CREATE POLICY "Authenticated users can read roles"
ON user_roles
FOR SELECT
TO authenticated
USING (true);

-- Block direct modifications - roles should be managed via edge functions with service role key
CREATE POLICY "Block direct modifications"
ON user_roles
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Fix super admin account: set venue_id to NULL for jina.ziyaad@gmail.com
UPDATE user_roles
SET venue_id = NULL
WHERE user_id = 'bd6f62e4-28e6-4763-b55f-73fa5f56392f'
AND role = 'super_admin';