-- Add FCM token column to profiles table for push notifications
ALTER TABLE public.profiles 
ADD COLUMN fcm_token TEXT;

-- Create index for faster FCM token lookups
CREATE INDEX idx_profiles_fcm_token ON public.profiles(fcm_token) WHERE fcm_token IS NOT NULL;

-- Function to send push notification via edge function
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
BEGIN
  -- Get user's FCM token
  SELECT fcm_token INTO v_fcm_token
  FROM public.profiles
  WHERE id = p_user_id AND fcm_token IS NOT NULL;
  
  -- If user has FCM token, call edge function
  IF v_fcm_token IS NOT NULL THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'fcmToken', v_fcm_token,
        'title', p_title,
        'body', p_body,
        'data', p_data
      )
    );
  END IF;
END;
$$;

-- Trigger function for waitlist status changes
CREATE OR REPLACE FUNCTION public.notify_waitlist_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_name TEXT;
BEGIN
  -- Only notify when status changes to 'ready'
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    -- Get venue name
    SELECT name INTO v_venue_name FROM public.venues WHERE id = NEW.venue_id;
    
    -- Send notification if user_id exists
    IF NEW.user_id IS NOT NULL THEN
      PERFORM notify_user_via_push(
        NEW.user_id,
        '🍽️ Your Table is Ready!',
        'Please proceed to ' || COALESCE(v_venue_name, 'the venue'),
        jsonb_build_object(
          'type', 'table_ready',
          'entry_id', NEW.id,
          'venue_id', NEW.venue_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for order status changes
CREATE OR REPLACE FUNCTION public.notify_order_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify when status changes to 'ready'
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    -- Send notification if user_id exists
    IF NEW.user_id IS NOT NULL THEN
      PERFORM notify_user_via_push(
        NEW.user_id,
        '🍔 Your Order is Ready!',
        'Order #' || NEW.order_number || ' is ready for pickup',
        jsonb_build_object(
          'type', 'order_ready',
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'venue_id', NEW.venue_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_waitlist_ready
  AFTER INSERT OR UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waitlist_ready();

CREATE TRIGGER on_order_ready
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_ready();