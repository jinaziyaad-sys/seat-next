-- Create patron notification preferences table
CREATE TABLE public.patron_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  mealtime_nudges BOOLEAN NOT NULL DEFAULT true,
  reengagement_nudges BOOLEAN NOT NULL DEFAULT true,
  favorite_venue_alerts BOOLEAN NOT NULL DEFAULT true,
  weekend_planning_nudges BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  nudge_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (nudge_frequency IN ('daily', 'weekly', 'minimal')),
  max_nudges_per_day INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patron nudge history table
CREATE TABLE public.patron_nudge_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nudge_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  venue_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  opened_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.patron_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patron_nudge_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for patron_notification_preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.patron_notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
ON public.patron_notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
ON public.patron_notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for patron_nudge_history
CREATE POLICY "Users can view their own nudge history"
ON public.patron_nudge_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert nudge history"
ON public.patron_nudge_history
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own nudge history"
ON public.patron_nudge_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_patron_nudge_history_user_id ON public.patron_nudge_history(user_id);
CREATE INDEX idx_patron_nudge_history_sent_at ON public.patron_nudge_history(sent_at);
CREATE INDEX idx_patron_nudge_history_nudge_type ON public.patron_nudge_history(nudge_type);

-- Trigger for updated_at on preferences
CREATE TRIGGER update_patron_notification_preferences_updated_at
BEFORE UPDATE ON public.patron_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();