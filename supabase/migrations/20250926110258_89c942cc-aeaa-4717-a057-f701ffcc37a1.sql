-- Create enums for order and waitlist status
CREATE TYPE public.order_status AS ENUM ('placed', 'in_prep', 'ready', 'collected', 'no_show');
CREATE TYPE public.waitlist_status AS ENUM ('waiting', 'ready', 'seated', 'cancelled', 'no_show');

-- Create venues table
CREATE TABLE public.venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'placed',
  items JSONB NOT NULL DEFAULT '[]',
  customer_name TEXT,
  customer_phone TEXT,
  eta TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(venue_id, order_number)
);

-- Create waitlist entries table
CREATE TABLE public.waitlist_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 1,
  preferences TEXT[],
  status public.waitlist_status NOT NULL DEFAULT 'waiting',
  position INTEGER,
  eta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing public access for now - can be refined later)
CREATE POLICY "Anyone can view venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Anyone can view waitlist entries" ON public.waitlist_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert waitlist entries" ON public.waitlist_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update waitlist entries" ON public.waitlist_entries FOR UPDATE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_waitlist_entries_updated_at
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time
ALTER TABLE public.venues REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.waitlist_entries REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.venues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist_entries;

-- Insert sample venues
INSERT INTO public.venues (name, address, phone) VALUES 
  ('The Gourmet Corner', '123 Main St, Downtown', '(555) 123-4567'),
  ('Seaside Bistro', '456 Ocean Ave, Waterfront', '(555) 987-6543'),
  ('Mountain View Cafe', '789 Hill Road, Uptown', '(555) 456-7890');

-- Insert some sample orders for testing
INSERT INTO public.orders (venue_id, order_number, status, items, customer_name, customer_phone, eta) 
SELECT 
  v.id,
  '#' || (1000 + floor(random() * 9000))::text,
  CASE floor(random() * 4)
    WHEN 0 THEN 'placed'::order_status
    WHEN 1 THEN 'in_prep'::order_status
    WHEN 2 THEN 'ready'::order_status
    ELSE 'in_prep'::order_status
  END,
  '[{"name": "Margherita Pizza", "quantity": 1}, {"name": "Caesar Salad", "quantity": 1}]'::jsonb,
  'John Doe',
  '(555) 123-0001',
  now() + interval '15 minutes'
FROM public.venues v 
LIMIT 2;