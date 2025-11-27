-- Add patron_dismissed column to orders table
ALTER TABLE public.orders
ADD COLUMN patron_dismissed boolean DEFAULT false;

-- Add patron_dismissed column to waitlist_entries table
ALTER TABLE public.waitlist_entries
ADD COLUMN patron_dismissed boolean DEFAULT false;

-- Allow patrons to dismiss their own orders (update patron_dismissed field)
CREATE POLICY "Users can dismiss their own orders"
ON public.orders
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);