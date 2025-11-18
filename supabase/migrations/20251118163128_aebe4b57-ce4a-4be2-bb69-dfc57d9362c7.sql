-- Function to automatically maintain waitlist positions
CREATE OR REPLACE FUNCTION public.update_waitlist_positions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Recalculate positions for all 'waiting' entries in the venue
  -- ordered by created_at (earliest gets position 1)
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
  )
  UPDATE waitlist_entries we
  SET position = re.new_position
  FROM ranked_entries re
  WHERE we.id = re.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger to update positions on insert
CREATE TRIGGER update_waitlist_positions_on_insert
AFTER INSERT ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_waitlist_positions();

-- Create trigger to update positions on status change
CREATE TRIGGER update_waitlist_positions_on_update
AFTER UPDATE OF status ON public.waitlist_entries
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.update_waitlist_positions();

-- Create trigger to update positions on delete
CREATE TRIGGER update_waitlist_positions_on_delete
AFTER DELETE ON public.waitlist_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_waitlist_positions();