CREATE OR REPLACE FUNCTION public.notify_venue_users_via_push(p_venue_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.venue_id = p_venue_id
      AND ur.role IN ('admin'::app_role, 'staff'::app_role)
  LOOP
    BEGIN
      PERFORM public.notify_user_via_push(v_user_id, p_title, p_body, p_data);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$function$;