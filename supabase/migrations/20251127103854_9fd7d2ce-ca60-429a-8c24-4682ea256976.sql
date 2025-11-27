-- Allow staff to delete waitlist entries from their venue
CREATE POLICY "Staff can delete venue waitlist entries"
ON public.waitlist_entries
FOR DELETE
USING (
  (venue_id IN (
    SELECT user_roles.venue_id
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
  ))
  OR is_super_admin(auth.uid())
);