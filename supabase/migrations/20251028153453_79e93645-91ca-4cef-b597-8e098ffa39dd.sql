-- Allow authenticated users (including guests) to insert waitlist entries
CREATE POLICY "Authenticated users can insert waitlist entries"
ON public.waitlist_entries
FOR INSERT
TO authenticated
WITH CHECK (true);