
-- Add patron_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS patron_code text UNIQUE;

-- Function to generate a unique patron code like "ZII-4829"
CREATE OR REPLACE FUNCTION public.generate_patron_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code text;
  prefix text;
  suffix text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits text := '0123456789';
  attempts int := 0;
BEGIN
  LOOP
    -- Generate 3 random uppercase letters + 4 random digits
    prefix := '';
    FOR i IN 1..3 LOOP
      prefix := prefix || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    suffix := '';
    FOR i IN 1..4 LOOP
      suffix := suffix || substr(digits, floor(random() * length(digits) + 1)::int, 1);
    END LOOP;
    
    new_code := prefix || '-' || suffix;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE patron_code = new_code) THEN
      RETURN new_code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique patron code after 100 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-set patron_code on insert if not provided
CREATE OR REPLACE FUNCTION public.set_patron_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.patron_code IS NULL THEN
    NEW.patron_code := generate_patron_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_patron_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_patron_code_on_insert();

-- Backfill existing profiles
UPDATE public.profiles 
SET patron_code = generate_patron_code() 
WHERE patron_code IS NULL;

-- Allow authenticated users to look up profiles by patron_code (for merchant scanning)
CREATE POLICY "Authenticated users can lookup by patron_code"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
