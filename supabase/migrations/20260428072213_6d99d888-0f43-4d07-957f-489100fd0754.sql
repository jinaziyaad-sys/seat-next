-- Notify all merchant/admin users assigned to a venue via existing push subscription flow
CREATE OR REPLACE FUNCTION public.notify_venue_users_via_push(
  p_venue_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.venue_id = p_venue_id
      AND ur.role IN ('admin', 'staff', 'moderator')
  LOOP
    PERFORM public.notify_user_via_push(v_user_id, p_title, p_body, p_data);
  END LOOP;
END;
$$;

-- Send merchant push when a new food order arrives
CREATE OR REPLACE FUNCTION public.notify_merchants_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_name text;
BEGIN
  SELECT name INTO v_venue_name FROM public.venues WHERE id = NEW.venue_id;

  PERFORM public.notify_venue_users_via_push(
    NEW.venue_id,
    '🍽️ New Order',
    'Order #' || COALESCE(NEW.order_number, 'new') || ' arrived' ||
      CASE WHEN v_venue_name IS NOT NULL THEN ' at ' || v_venue_name ELSE '' END,
    jsonb_build_object(
      'type', 'merchant_new_order',
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'venue_id', NEW.venue_id,
      'url', '/merchant/dashboard'
    )
  );

  RETURN NEW;
END;
$$;

-- Send merchant push when someone joins the waitlist or creates a reservation
CREATE OR REPLACE FUNCTION public.notify_merchants_new_waitlist_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_name text;
  v_is_reservation boolean;
  v_title text;
  v_body text;
BEGIN
  SELECT name INTO v_venue_name FROM public.venues WHERE id = NEW.venue_id;
  v_is_reservation := COALESCE(NEW.reservation_type, 'walk_in') = 'reservation';
  v_title := CASE WHEN v_is_reservation THEN '📅 New Reservation' ELSE '👥 New Waitlist Entry' END;
  v_body := CASE
    WHEN v_is_reservation THEN COALESCE(NEW.customer_name, 'A guest') || ' made a reservation for ' || COALESCE(NEW.party_size::text, 'their party')
    ELSE COALESCE(NEW.customer_name, 'A guest') || ' joined the waitlist' || CASE WHEN NEW.party_size IS NOT NULL THEN ' for ' || NEW.party_size::text ELSE '' END
  END || CASE WHEN v_venue_name IS NOT NULL THEN ' at ' || v_venue_name ELSE '' END;

  PERFORM public.notify_venue_users_via_push(
    NEW.venue_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', CASE WHEN v_is_reservation THEN 'merchant_new_reservation' ELSE 'merchant_new_waitlist' END,
      'entry_id', NEW.id,
      'venue_id', NEW.venue_id,
      'url', '/merchant/dashboard'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchants_new_order ON public.orders;
CREATE TRIGGER trg_notify_merchants_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchants_new_order();

DROP TRIGGER IF EXISTS trg_notify_merchants_new_waitlist_entry ON public.waitlist_entries;
CREATE TRIGGER trg_notify_merchants_new_waitlist_entry
AFTER INSERT ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchants_new_waitlist_entry();