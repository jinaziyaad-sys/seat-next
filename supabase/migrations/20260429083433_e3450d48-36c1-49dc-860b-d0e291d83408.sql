-- Store service role key in vault if not already present
DO $$
DECLARE
  v_key text;
BEGIN
  -- Check if secret exists in vault
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    -- Try to read from settings as a one-time bootstrap
    v_key := current_setting('app.settings.service_role_key', true);
    IF v_key IS NOT NULL AND length(v_key) > 0 THEN
      PERFORM vault.create_secret(v_key, 'service_role_key', 'Service role key for trigger HTTP calls');
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_user_via_push(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_sub BOOLEAN;
  v_supabase_url TEXT := 'https://cuoqjgahpfymxqrdlzlf.supabase.co';
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = p_user_id
  ) INTO v_has_sub;

  IF NOT v_has_sub THEN
    RAISE LOG 'notify_user_via_push: no push subscription for user=%', p_user_id;
    RETURN;
  END IF;

  -- Try vault first, fall back to setting
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := NULL;
  END;

  IF v_service_role_key IS NULL OR length(v_service_role_key) = 0 THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF v_service_role_key IS NULL OR length(v_service_role_key) = 0 THEN
    RAISE LOG 'notify_user_via_push: NO SERVICE ROLE KEY available, cannot send push to user=%', p_user_id;
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'userId', p_user_id,
        'title', p_title,
        'body', p_body,
        'data', p_data
      )
    ) INTO v_request_id;
    RAISE LOG 'notify_user_via_push: dispatched request_id=% user=%', v_request_id, p_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'notify_user_via_push HTTP ERROR: % user=%', SQLERRM, p_user_id;
  END;
END;
$function$;