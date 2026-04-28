
CREATE OR REPLACE FUNCTION public.notify_user_via_push(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_sub BOOLEAN;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = p_user_id
  ) INTO v_has_sub;

  IF NOT v_has_sub THEN
    RETURN;
  END IF;

  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_role_key := current_setting('app.settings.service_role_key', true);

    IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
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
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$function$;
