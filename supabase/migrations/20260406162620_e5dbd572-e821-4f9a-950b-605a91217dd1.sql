
-- Phase 3: Merchant Announcements
CREATE TABLE public.merchant_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  audience text NOT NULL DEFAULT 'all',
  target_venue_ids uuid[] DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  dismissible boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  expires_at timestamptz DEFAULT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.merchant_announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.merchant_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

ALTER TABLE public.merchant_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Announcements: anyone authenticated can read active ones
CREATE POLICY "Authenticated users can view active announcements"
  ON public.merchant_announcements FOR SELECT TO authenticated
  USING (is_active = true);

-- Super admins can manage announcements
CREATE POLICY "Super admins can manage announcements"
  ON public.merchant_announcements FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Users can insert their own dismissals
CREATE POLICY "Users can dismiss announcements"
  ON public.merchant_announcement_dismissals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own dismissals
CREATE POLICY "Users can view own dismissals"
  ON public.merchant_announcement_dismissals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Phase 2: Sponsored Ads columns
ALTER TABLE public.promo_campaigns
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Phase 1: PayFast payment_provider column
ALTER TABLE public.merchant_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'stripe';
