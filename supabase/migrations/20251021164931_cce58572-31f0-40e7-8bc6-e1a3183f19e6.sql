-- Allow users to update their own waitlist entries
CREATE POLICY "Users can update their own waitlist entries"
ON public.waitlist_entries
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);