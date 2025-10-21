-- Add RLS policies for super_admins to manage venues
CREATE POLICY "Super admins can insert venues"
ON public.venues
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update venues"
ON public.venues
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete venues"
ON public.venues
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));