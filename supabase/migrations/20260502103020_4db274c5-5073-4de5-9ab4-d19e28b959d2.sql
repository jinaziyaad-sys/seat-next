
-- Add channel toggles + opt-out timestamps
ALTER TABLE public.patron_notification_preferences
  ADD COLUMN IF NOT EXISTS channel_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS channel_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS channel_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at timestamptz;

-- Notification log
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push','sms','whatsapp')),
  category text,
  title text,
  body text,
  provider_sid text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  cost_estimate numeric(10,4),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON public.notification_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_provider_sid ON public.notification_log(provider_sid);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification log"
  ON public.notification_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins view all notification log"
  ON public.notification_log FOR SELECT
  USING (public.is_super_admin(auth.uid()));
