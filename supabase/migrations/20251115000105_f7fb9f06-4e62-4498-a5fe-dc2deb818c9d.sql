-- Fix search_path security warning for cancel_expired_ready_entries function
CREATE OR REPLACE FUNCTION cancel_expired_ready_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cancel entries that are in 'ready' status and past their deadline
  UPDATE waitlist_entries
  SET 
    status = 'no_show',
    cancellation_reason = 'Automatic cancellation - patron did not arrive within time limit',
    updated_at = now()
  WHERE 
    status = 'ready' 
    AND ready_deadline IS NOT NULL 
    AND ready_deadline < now();
END;
$$;