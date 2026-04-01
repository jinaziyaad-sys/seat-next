-- 1. Create platform_audit_log table
CREATE TABLE public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view audit log"
ON public.platform_audit_log FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2. Security definer function so triggers can insert
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_details);
END;
$$;

-- 3. Trigger functions
CREATE OR REPLACE FUNCTION public.audit_venue_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('create', 'venue', NEW.id, jsonb_build_object('name', NEW.name));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event('update', 'venue', NEW.id, jsonb_build_object('name', NEW.name));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event('delete', 'venue', OLD.id, jsonb_build_object('name', OLD.name));
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('assign_role', 'user_role', NEW.id, jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role, 'venue_id', NEW.venue_id));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event('remove_role', 'user_role', OLD.id, jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role, 'venue_id', OLD.venue_id));
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_platform_config_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event('update', 'platform_config', NEW.id, jsonb_build_object('key', NEW.key, 'old_value', OLD.value, 'new_value', NEW.value));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_loyalty_program_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event('create', 'loyalty_program', NEW.id, jsonb_build_object('venue_id', NEW.venue_id, 'type', NEW.type));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event('update', 'loyalty_program', NEW.id, jsonb_build_object('venue_id', NEW.venue_id, 'is_active', NEW.is_active));
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach triggers
CREATE TRIGGER audit_venues
  AFTER INSERT OR UPDATE OR DELETE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.audit_venue_changes();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();

CREATE TRIGGER audit_platform_config
  AFTER UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_platform_config_changes();

CREATE TRIGGER audit_loyalty_programs
  AFTER INSERT OR UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.audit_loyalty_program_changes();

-- 5. Add rollout columns to platform_config
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS rollout_percentage integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS user_segments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 6. Indexes
CREATE INDEX idx_audit_log_created_at ON public.platform_audit_log (created_at DESC);
CREATE INDEX idx_audit_log_entity_type ON public.platform_audit_log (entity_type);