-- Update notify_user_via_push function to gracefully handle missing configuration
CREATE OR REPLACE FUNCTION public.notify_user_via_push(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fcm_token TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get user's FCM token
  SELECT fcm_token INTO v_fcm_token
  FROM public.profiles
  WHERE id = p_user_id AND fcm_token IS NOT NULL;
  
  -- If user has FCM token, try to call edge function
  IF v_fcm_token IS NOT NULL THEN
    BEGIN
      -- Try to get configuration settings (may not exist)
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_role_key := current_setting('app.settings.service_role_key', true);
      
      -- Only attempt HTTP call if both settings exist
      IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'fcmToken', v_fcm_token,
            'title', p_title,
            'body', p_body,
            'data', p_data
          )
        );
      END IF;
    EXCEPTION
      -- Silently catch any errors to prevent blocking the main operation
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
END;
$$;