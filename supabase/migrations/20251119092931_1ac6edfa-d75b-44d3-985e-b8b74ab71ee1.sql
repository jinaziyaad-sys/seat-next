-- Update the waitlist position calculation function to only count walk-in entries
CREATE OR REPLACE FUNCTION public.update_waitlist_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Recalculate positions for all 'waiting' WALK-IN entries in the venue
  -- ordered by created_at (earliest gets position 1)
  -- Reservations are excluded from walk-in queue positioning
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY venue_id 
        ORDER BY created_at ASC
      ) as new_position
    FROM waitlist_entries
    WHERE venue_id = COALESCE(NEW.venue_id, OLD.venue_id)
      AND status = 'waiting'
      AND reservation_type = 'walk_in'
  )
  UPDATE waitlist_entries we
  SET position = re.new_position
  FROM ranked_entries re
  WHERE we.id = re.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Clean up old test reservation entries by updating their status
UPDATE public.waitlist_entries
SET status = 'cancelled',
    cancellation_reason = 'Test data cleanup',
    updated_at = now()
WHERE reservation_type = 'reservation'
  AND status = 'waiting'
  AND created_at < now() - INTERVAL '1 hour';