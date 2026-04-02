
-- Add group_id to waitlist_entries for friend group tracking
ALTER TABLE public.waitlist_entries ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.waitlist_entries(id) ON DELETE SET NULL;

-- Add preferred_language to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

-- Create patron_connections table
CREATE TABLE public.patron_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.patron_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON public.patron_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert own connections"
  ON public.patron_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON public.patron_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own connections"
  ON public.patron_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create patron_checkins table
CREATE TABLE public.patron_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 hours')
);

ALTER TABLE public.patron_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checkins of friends"
  ON public.patron_checkins FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT CASE WHEN pc.user_id = auth.uid() THEN pc.friend_id ELSE pc.user_id END
      FROM public.patron_connections pc
      WHERE (pc.user_id = auth.uid() OR pc.friend_id = auth.uid())
        AND pc.status = 'accepted'
    )
  );

CREATE POLICY "Users can insert own checkins"
  ON public.patron_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own checkins"
  ON public.patron_checkins FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-checkin trigger: when a patron joins waitlist or places order
CREATE OR REPLACE FUNCTION public.auto_checkin_patron()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.patron_checkins (user_id, venue_id)
    VALUES (NEW.user_id, NEW.venue_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_checkin_waitlist
  AFTER INSERT ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.auto_checkin_patron();

CREATE TRIGGER trg_auto_checkin_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_checkin_patron();
