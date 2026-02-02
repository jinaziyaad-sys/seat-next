-- Update handle_new_user trigger to support Google OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, verification_method)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',        -- Google uses 'name'
      NEW.raw_user_meta_data->>'given_name',  -- Fallback for Google
      ''
    ),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'verification_method'
  );
  RETURN NEW;
END;
$function$;