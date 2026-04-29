
CREATE OR REPLACE FUNCTION public.notify_order_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
BEGIN
  -- Only act when status actually changes
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'placed' THEN
      v_title := '✅ Order Received';
      v_body  := 'Order #' || NEW.order_number || ' has been received by the venue';
      v_type  := 'order_placed';
    WHEN 'in_prep' THEN
      v_title := '👨‍🍳 Order Being Prepared';
      v_body  := 'The kitchen has started preparing order #' || NEW.order_number;
      v_type  := 'order_in_prep';
    WHEN 'ready' THEN
      v_title := '🍔 Your Order is Ready!';
      v_body  := 'Order #' || NEW.order_number || ' is ready for pickup';
      v_type  := 'order_ready';
    WHEN 'collected' THEN
      v_title := '🎉 Order Collected';
      v_body  := 'Thanks for picking up order #' || NEW.order_number || '. Enjoy!';
      v_type  := 'order_collected';
    WHEN 'rejected' THEN
      v_title := '❌ Order Rejected';
      v_body  := 'Unfortunately order #' || NEW.order_number || ' was rejected by the venue';
      v_type  := 'order_rejected';
    WHEN 'cancelled' THEN
      v_title := '🚫 Order Cancelled';
      v_body  := 'Order #' || NEW.order_number || ' has been cancelled';
      v_type  := 'order_cancelled';
    WHEN 'no_show' THEN
      v_title := '⏰ Order Marked No-Show';
      v_body  := 'Order #' || NEW.order_number || ' was marked as no-show';
      v_type  := 'order_no_show';
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM notify_user_via_push(
    NEW.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', v_type,
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'venue_id', NEW.venue_id,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_waitlist_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_venue_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_venue_name FROM public.venues WHERE id = NEW.venue_id;

  CASE NEW.status
    WHEN 'waiting' THEN
      v_title := '📝 You''re on the Waitlist';
      v_body  := 'You''ve been added to the waitlist at ' || COALESCE(v_venue_name, 'the venue');
      v_type  := 'waitlist_waiting';
    WHEN 'ready' THEN
      v_title := '🍽️ Your Table is Ready!';
      v_body  := 'Please proceed to ' || COALESCE(v_venue_name, 'the venue');
      v_type  := 'table_ready';
    WHEN 'seated' THEN
      v_title := '🪑 You''re Seated';
      v_body  := 'Enjoy your visit at ' || COALESCE(v_venue_name, 'the venue') || '!';
      v_type  := 'waitlist_seated';
    WHEN 'cancelled' THEN
      v_title := '🚫 Waitlist Cancelled';
      v_body  := 'Your waitlist entry at ' || COALESCE(v_venue_name, 'the venue') || ' was cancelled';
      v_type  := 'waitlist_cancelled';
    WHEN 'no_show' THEN
      v_title := '⏰ Marked No-Show';
      v_body  := 'You were marked no-show at ' || COALESCE(v_venue_name, 'the venue');
      v_type  := 'waitlist_no_show';
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM notify_user_via_push(
    NEW.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', v_type,
      'entry_id', NEW.id,
      'venue_id', NEW.venue_id,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$function$;
