-- Create platform_config table for real-time configuration management
CREATE TABLE public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage platform config"
ON public.platform_config
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- All authenticated users can read config
CREATE POLICY "Authenticated users can read platform config"
ON public.platform_config
FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable realtime for instant updates across all clients
ALTER TABLE public.platform_config REPLICA IDENTITY FULL;

-- Insert default configuration values
INSERT INTO public.platform_config (key, value, description, category) VALUES
  ('feature.food_ordering_enabled', 'true', 'Enable/disable food ordering across all venues', 'feature_flag'),
  ('feature.waitlist_enabled', 'true', 'Enable/disable waitlist functionality', 'feature_flag'),
  ('feature.reservations_enabled', 'true', 'Enable/disable reservations', 'feature_flag'),
  ('feature.ratings_enabled', 'true', 'Enable/disable customer ratings', 'feature_flag'),
  ('feature.kitchen_board_enabled', 'true', 'Enable/disable kitchen board view', 'feature_flag'),
  ('feature.analytics_enabled', 'true', 'Enable/disable analytics dashboards', 'feature_flag'),
  ('global.default_prep_time_minutes', '15', 'Default food preparation time in minutes', 'global_setting'),
  ('global.default_wait_time_minutes', '20', 'Default waitlist wait time in minutes', 'global_setting'),
  ('global.max_party_size', '20', 'Maximum party size for waitlist', 'global_setting'),
  ('global.ready_deadline_minutes', '10', 'Minutes before a ready order/table expires', 'global_setting'),
  ('ai.help_assistant_enabled', 'true', 'Enable/disable AI help assistant', 'ai_config'),
  ('announcement.active', 'null', 'Currently active global announcement', 'announcement');

-- Create trigger for updated_at
CREATE TRIGGER update_platform_config_updated_at
  BEFORE UPDATE ON public.platform_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();