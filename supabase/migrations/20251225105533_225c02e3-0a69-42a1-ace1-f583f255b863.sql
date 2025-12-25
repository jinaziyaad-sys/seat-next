-- Create platform_errors table for capturing runtime errors
CREATE TABLE public.platform_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  component TEXT,
  route TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  browser_info TEXT,
  device_info TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved', 'ignored')),
  ai_analysis JSONB,
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create feature_requests table for tracking user feedback
CREATE TABLE public.feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'planned', 'in_progress', 'completed', 'rejected')),
  source TEXT NOT NULL DEFAULT 'dev' CHECK (source IN ('merchant', 'patron', 'dev')),
  submitter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_summary TEXT,
  similar_request_ids UUID[],
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_operations_log table for tracking AI analysis actions
CREATE TABLE public.ai_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.platform_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_operations_log ENABLE ROW LEVEL SECURITY;

-- Platform errors policies - only super admins can manage
CREATE POLICY "Super admins can view all errors"
ON public.platform_errors FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can insert errors"
ON public.platform_errors FOR INSERT
WITH CHECK (true);

CREATE POLICY "Super admins can update errors"
ON public.platform_errors FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete errors"
ON public.platform_errors FOR DELETE
USING (is_super_admin(auth.uid()));

-- Feature requests policies
CREATE POLICY "Super admins can view all feature requests"
ON public.feature_requests FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own requests"
ON public.feature_requests FOR SELECT
USING (auth.uid() = submitter_id);

CREATE POLICY "Authenticated users can insert feature requests"
ON public.feature_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can update feature requests"
ON public.feature_requests FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete feature requests"
ON public.feature_requests FOR DELETE
USING (is_super_admin(auth.uid()));

-- AI operations log policies - only super admins
CREATE POLICY "Super admins can view AI operations log"
ON public.ai_operations_log FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert AI operations log"
ON public.ai_operations_log FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_platform_errors_status ON public.platform_errors(status);
CREATE INDEX idx_platform_errors_created_at ON public.platform_errors(created_at DESC);
CREATE INDEX idx_platform_errors_error_type ON public.platform_errors(error_type);
CREATE INDEX idx_feature_requests_status ON public.feature_requests(status);
CREATE INDEX idx_feature_requests_priority ON public.feature_requests(priority);
CREATE INDEX idx_feature_requests_created_at ON public.feature_requests(created_at DESC);
CREATE INDEX idx_ai_operations_log_action_type ON public.ai_operations_log(action_type);
CREATE INDEX idx_ai_operations_log_created_at ON public.ai_operations_log(created_at DESC);

-- Create trigger for updating feature_requests updated_at
CREATE TRIGGER update_feature_requests_updated_at
BEFORE UPDATE ON public.feature_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();