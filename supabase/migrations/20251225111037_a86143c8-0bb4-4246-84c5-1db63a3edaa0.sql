-- Add source tracking columns to platform_errors table
ALTER TABLE public.platform_errors 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS venue_id uuid,
ADD COLUMN IF NOT EXISTS venue_name text,
ADD COLUMN IF NOT EXISTS issue_category text;

-- Add comment for source column
COMMENT ON COLUMN public.platform_errors.source IS 'Source of the error: auto (runtime), patron (user-reported), merchant (staff-reported)';

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_platform_errors_source ON public.platform_errors(source);

-- Create index for filtering by venue
CREATE INDEX IF NOT EXISTS idx_platform_errors_venue_id ON public.platform_errors(venue_id);