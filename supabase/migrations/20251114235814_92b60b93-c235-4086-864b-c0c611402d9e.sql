-- Add ready_at timestamp to track when table becomes ready
ALTER TABLE waitlist_entries 
ADD COLUMN IF NOT EXISTS ready_at timestamp with time zone;

-- Add ready_deadline to track when patron must be seated by
ALTER TABLE waitlist_entries 
ADD COLUMN IF NOT EXISTS ready_deadline timestamp with time zone;

-- Create index for efficient queries on ready entries with deadlines
CREATE INDEX IF NOT EXISTS idx_waitlist_ready_deadline 
ON waitlist_entries(status, ready_deadline) 
WHERE status = 'ready' AND ready_deadline IS NOT NULL;

-- Create function to auto-cancel expired ready entries
CREATE OR REPLACE FUNCTION cancel_expired_ready_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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