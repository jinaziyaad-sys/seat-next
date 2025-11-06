-- Add awaiting_merchant_confirmation column to waitlist_entries
ALTER TABLE public.waitlist_entries 
ADD COLUMN awaiting_merchant_confirmation boolean DEFAULT false;

-- Add index for merchant queries
CREATE INDEX idx_waitlist_awaiting_confirmation 
ON public.waitlist_entries(venue_id, awaiting_merchant_confirmation) 
WHERE awaiting_merchant_confirmation = true;

-- Create waitlist_ratings table
CREATE TABLE public.waitlist_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id uuid REFERENCES public.waitlist_entries(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on waitlist_ratings
ALTER TABLE public.waitlist_ratings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own ratings
CREATE POLICY "Users can insert their own waitlist ratings"
  ON public.waitlist_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own ratings
CREATE POLICY "Users can view their own waitlist ratings"
  ON public.waitlist_ratings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow venue staff to view ratings for their venue
CREATE POLICY "Staff can view venue waitlist ratings"
  ON public.waitlist_ratings
  FOR SELECT
  TO authenticated
  USING (
    venue_id IN (
      SELECT venue_id FROM public.user_roles
      WHERE user_id = auth.uid()
    ) OR is_super_admin(auth.uid())
  );

-- Create indexes for waitlist_ratings
CREATE INDEX idx_waitlist_ratings_entry ON public.waitlist_ratings(waitlist_entry_id);
CREATE INDEX idx_waitlist_ratings_venue ON public.waitlist_ratings(venue_id);
CREATE INDEX idx_waitlist_ratings_user ON public.waitlist_ratings(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_waitlist_ratings_updated_at
  BEFORE UPDATE ON public.waitlist_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();