-- Drop the unique constraint that prevents patrons from having multiple active reservations
-- This allows patrons to intentionally book multiple tables at the same venue/time after confirmation
DROP INDEX IF EXISTS unique_active_reservation_per_user_time;