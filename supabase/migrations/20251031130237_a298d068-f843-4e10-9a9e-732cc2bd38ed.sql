-- Update the venues UPDATE policy to allow admins to update their own venue
DROP POLICY IF EXISTS "Super admins can update venues" ON public.venues;

CREATE POLICY "Admins can update their venue"
ON public.venues
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR 
  id IN (SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);