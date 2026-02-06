-- Add timezone column to venues (default to South Africa for existing venues)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Johannesburg';

-- Add comment for documentation
COMMENT ON COLUMN venues.timezone IS 'IANA timezone identifier for venue location';