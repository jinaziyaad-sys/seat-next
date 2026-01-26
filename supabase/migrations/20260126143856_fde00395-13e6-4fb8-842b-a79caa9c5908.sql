-- Patron dining preferences table for personalized venue recommendations
CREATE TABLE public.patron_dining_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  dietary_requirements text[] DEFAULT '{}',
  cuisine_preferences text[] DEFAULT '{}',
  avoid_ingredients text[] DEFAULT '{}',
  max_wait_minutes int DEFAULT 30,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.patron_dining_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for patron dining preferences
CREATE POLICY "Users can read own dining preferences" 
ON public.patron_dining_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dining preferences" 
ON public.patron_dining_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dining preferences" 
ON public.patron_dining_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dining preferences" 
ON public.patron_dining_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_patron_dining_preferences_updated_at
BEFORE UPDATE ON public.patron_dining_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_patron_dining_preferences_user_id ON public.patron_dining_preferences(user_id);