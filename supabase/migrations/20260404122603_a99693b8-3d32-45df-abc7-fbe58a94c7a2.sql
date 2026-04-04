-- Remove duplicate triggers on waitlist_entries
DROP TRIGGER IF EXISTS trg_update_waitlist_positions ON public.waitlist_entries;
DROP TRIGGER IF EXISTS trigger_track_waitlist_analytics ON public.waitlist_entries;
DROP TRIGGER IF EXISTS on_waitlist_seated_update_customer_analytics ON public.waitlist_entries;
DROP TRIGGER IF EXISTS on_waitlist_ready ON public.waitlist_entries;

-- Remove duplicate triggers on orders
DROP TRIGGER IF EXISTS trigger_track_order_analytics ON public.orders;
DROP TRIGGER IF EXISTS on_order_completed_update_customer_analytics ON public.orders;
DROP TRIGGER IF EXISTS on_order_ready ON public.orders;

-- Fix: update_waitlist_positions_on_update should only fire on status changes, not re-trigger from updated_at
DROP TRIGGER IF EXISTS update_waitlist_positions_on_update ON public.waitlist_entries;
CREATE TRIGGER update_waitlist_positions_on_update
  AFTER UPDATE OF status ON public.waitlist_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_waitlist_positions();

-- Fix: remaining triggers that fire on ALL updates need status-change guards
DROP TRIGGER IF EXISTS trg_track_waitlist_analytics ON public.waitlist_entries;
CREATE TRIGGER trg_track_waitlist_analytics
  AFTER INSERT OR UPDATE OF status ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION track_waitlist_analytics();

DROP TRIGGER IF EXISTS trg_update_customer_analytics_on_waitlist ON public.waitlist_entries;
CREATE TRIGGER trg_update_customer_analytics_on_waitlist
  AFTER UPDATE OF status ON public.waitlist_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_customer_analytics_on_waitlist();

DROP TRIGGER IF EXISTS trg_notify_waitlist_ready ON public.waitlist_entries;
CREATE TRIGGER trg_notify_waitlist_ready
  AFTER UPDATE OF status ON public.waitlist_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_waitlist_ready();

-- Fix order triggers too
DROP TRIGGER IF EXISTS trg_track_order_analytics ON public.orders;
CREATE TRIGGER trg_track_order_analytics
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION track_order_analytics();

DROP TRIGGER IF EXISTS trg_update_customer_analytics_on_order ON public.orders;
CREATE TRIGGER trg_update_customer_analytics_on_order
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_customer_analytics_on_order();

DROP TRIGGER IF EXISTS trg_notify_order_ready ON public.orders;
CREATE TRIGGER trg_notify_order_ready
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_order_ready();