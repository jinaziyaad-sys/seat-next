-- Fix: only fire loyalty triggers when status actually changes
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_order ON public.orders;
CREATE TRIGGER trg_credit_loyalty_on_order
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.credit_loyalty_on_order();

DROP TRIGGER IF EXISTS trg_credit_loyalty_on_waitlist ON public.waitlist_entries;
CREATE TRIGGER trg_credit_loyalty_on_waitlist
  AFTER UPDATE OF status ON public.waitlist_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.credit_loyalty_on_waitlist();