
CREATE OR REPLACE FUNCTION public.notify_user_via_push(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT := 'https://cuoqjgahpfymxqrdlzlf.supabase.co/functions/v1/dispatch-notification';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b3FqZ2FocGZ5bXhxcmRsemxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzcyOTUsImV4cCI6MjA3MzAxMzI5NX0.3_qlOFfvD3FOHfHVeGnF4X_fql5fWgtP5B4Sk4qAYbE';
  v_request_id BIGINT;
  v_category TEXT;
BEGIN
  v_category := COALESCE(p_data->>'type', 'general');

  BEGIN
    SELECT net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon_key,
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'userId', p_user_id,
        'title', p_title,
        'body', p_body,
        'data', p_data,
        'category', v_category
      )
    ) INTO v_request_id;
    RAISE LOG 'notify_user_via_push: dispatched request_id=% user=% category=%', v_request_id, p_user_id, v_category;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'notify_user_via_push HTTP ERROR: % user=%', SQLERRM, p_user_id;
  END;
END;
$function$;
