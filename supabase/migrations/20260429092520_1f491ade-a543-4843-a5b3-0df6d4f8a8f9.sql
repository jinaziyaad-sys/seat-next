CREATE OR REPLACE FUNCTION public.format_eta_time(p_eta timestamp with time zone)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_eta IS NULL THEN NULL
    ELSE to_char(p_eta AT TIME ZONE 'UTC', 'HH24:MI') || ' UTC'
  END
$$;

CREATE OR REPLACE FUNCTION public.extract_extension_reason(p_notes text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(trim(regexp_replace(COALESCE(p_notes, ''), '^Extended:\s*', '', 'i')), '')
$$;

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
  v_reason TEXT;
  v_is_insert BOOLEAN := TG_OP = 'INSERT';
  v_status_changed BOOLEAN := TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status;
  v_eta_changed BOOLEAN := TG_OP = 'UPDATE' AND OLD.eta IS DISTINCT FROM NEW.eta;
  v_eta_minutes INTEGER;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_status_changed THEN
    CASE NEW.status
      WHEN 'awaiting_verification' THEN
        v_title := '🔎 Order Being Checked';
        v_body  := 'Your order is being verified by the venue';
        v_type  := 'order_awaiting_verification';
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
        v_title := NULL;
    END CASE;
  ELSIF v_eta_changed AND NEW.eta IS NOT NULL THEN
    v_reason := public.extract_extension_reason(NEW.notes);
    v_type := CASE WHEN OLD.eta IS NOT NULL AND NEW.eta > OLD.eta THEN 'order_delayed' ELSE 'order_eta_updated' END;
    v_title := CASE WHEN v_type = 'order_delayed' THEN '⏳ Order Delayed' ELSE '⏱️ Order ETA Updated' END;

    IF OLD.eta IS NOT NULL AND NEW.eta > OLD.eta THEN
      v_eta_minutes := CEIL(EXTRACT(EPOCH FROM (NEW.eta - OLD.eta)) / 60.0)::INTEGER;
      v_body := 'Order #' || NEW.order_number || ' is running about ' || v_eta_minutes || ' minute' || CASE WHEN v_eta_minutes = 1 THEN '' ELSE 's' END || ' later';
    ELSE
      v_body := 'Order #' || NEW.order_number || ' ETA has been updated';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_body := v_body || ': ' || v_reason;
    END IF;
  END IF;

  IF v_title IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_user_via_push(
    NEW.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', v_type,
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'venue_id', NEW.venue_id,
      'status', NEW.status,
      'eta', NEW.eta,
      'url', '/app'
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
  v_reason TEXT;
  v_label TEXT;
  v_is_reservation BOOLEAN;
  v_status_changed BOOLEAN := TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status;
  v_eta_changed BOOLEAN := TG_OP = 'UPDATE' AND OLD.eta IS DISTINCT FROM NEW.eta;
  v_eta_minutes INTEGER;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_venue_name FROM public.venues WHERE id = NEW.venue_id;
  v_is_reservation := COALESCE(NEW.reservation_type, 'walkin') = 'reservation';
  v_label := CASE WHEN v_is_reservation THEN 'reservation' ELSE 'table' END;

  IF v_status_changed THEN
    CASE NEW.status
      WHEN 'waiting' THEN
        v_title := CASE WHEN v_is_reservation THEN '✅ Reservation Confirmed' ELSE '📝 You''re on the Waitlist' END;
        v_body  := CASE WHEN v_is_reservation
          THEN 'Your reservation at ' || COALESCE(v_venue_name, 'the venue') || ' is confirmed'
          ELSE 'You''ve been added to the waitlist at ' || COALESCE(v_venue_name, 'the venue')
        END;
        v_type  := CASE WHEN v_is_reservation THEN 'reservation_waiting' ELSE 'waitlist_waiting' END;
      WHEN 'ready' THEN
        v_title := '🍽️ Your Table is Ready!';
        v_body  := 'Please proceed to ' || COALESCE(v_venue_name, 'the venue');
        v_type  := 'table_ready';
      WHEN 'seated' THEN
        v_title := '🪑 You''re Seated';
        v_body  := 'Enjoy your visit at ' || COALESCE(v_venue_name, 'the venue') || '!';
        v_type  := CASE WHEN v_is_reservation THEN 'reservation_seated' ELSE 'waitlist_seated' END;
      WHEN 'cancelled' THEN
        v_title := CASE WHEN v_is_reservation THEN '🚫 Reservation Cancelled' ELSE '🚫 Waitlist Cancelled' END;
        v_body  := 'Your ' || v_label || ' at ' || COALESCE(v_venue_name, 'the venue') || ' was cancelled';
        IF NEW.cancellation_reason IS NOT NULL THEN
          v_body := v_body || ': ' || NEW.cancellation_reason;
        END IF;
        v_type  := CASE WHEN v_is_reservation THEN 'reservation_cancelled' ELSE 'waitlist_cancelled' END;
      WHEN 'no_show' THEN
        v_title := '⏰ Marked No-Show';
        v_body  := 'You were marked no-show at ' || COALESCE(v_venue_name, 'the venue');
        v_type  := CASE WHEN v_is_reservation THEN 'reservation_no_show' ELSE 'waitlist_no_show' END;
      ELSE
        v_title := NULL;
    END CASE;
  ELSIF v_eta_changed AND NEW.eta IS NOT NULL THEN
    v_reason := public.extract_extension_reason(NEW.notes);
    v_type := CASE WHEN OLD.eta IS NOT NULL AND NEW.eta > OLD.eta THEN v_label || '_delayed' ELSE v_label || '_eta_updated' END;
    v_title := CASE WHEN OLD.eta IS NOT NULL AND NEW.eta > OLD.eta
      THEN CASE WHEN v_is_reservation THEN '⏳ Reservation Delayed' ELSE '⏳ Table Wait Extended' END
      ELSE CASE WHEN v_is_reservation THEN '⏱️ Reservation Time Updated' ELSE '⏱️ Table ETA Updated' END
    END;

    IF OLD.eta IS NOT NULL AND NEW.eta > OLD.eta THEN
      v_eta_minutes := CEIL(EXTRACT(EPOCH FROM (NEW.eta - OLD.eta)) / 60.0)::INTEGER;
      v_body := 'Your ' || v_label || ' at ' || COALESCE(v_venue_name, 'the venue') || ' is running about ' || v_eta_minutes || ' minute' || CASE WHEN v_eta_minutes = 1 THEN '' ELSE 's' END || ' later';
    ELSE
      v_body := 'Your ' || v_label || ' ETA at ' || COALESCE(v_venue_name, 'the venue') || ' has been updated';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_body := v_body || ': ' || v_reason;
    END IF;
  END IF;

  IF v_title IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_user_via_push(
    NEW.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', v_type,
      'entry_id', NEW.id,
      'venue_id', NEW.venue_id,
      'status', NEW.status,
      'eta', NEW.eta,
      'reservation_type', NEW.reservation_type,
      'url', '/app'
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_order_ready ON public.orders;
CREATE TRIGGER trg_notify_order_tracking_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_ready();

CREATE TRIGGER trg_notify_order_tracking_update
AFTER UPDATE OF status, eta, notes ON public.orders
FOR EACH ROW
WHEN ((OLD.status IS DISTINCT FROM NEW.status) OR (OLD.eta IS DISTINCT FROM NEW.eta))
EXECUTE FUNCTION public.notify_order_ready();

DROP TRIGGER IF EXISTS trg_notify_waitlist_ready ON public.waitlist_entries;
CREATE TRIGGER trg_notify_waitlist_tracking_insert
AFTER INSERT ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.notify_waitlist_ready();

CREATE TRIGGER trg_notify_waitlist_tracking_update
AFTER UPDATE OF status, eta, notes, cancellation_reason ON public.waitlist_entries
FOR EACH ROW
WHEN ((OLD.status IS DISTINCT FROM NEW.status) OR (OLD.eta IS DISTINCT FROM NEW.eta))
EXECUTE FUNCTION public.notify_waitlist_ready();