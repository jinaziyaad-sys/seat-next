-- Create order_ratings table for customer feedback
CREATE TABLE IF NOT EXISTS public.order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS on order_ratings
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

-- Users can insert their own ratings
CREATE POLICY "Users can insert their own ratings"
  ON public.order_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own ratings
CREATE POLICY "Users can view their own ratings"
  ON public.order_ratings FOR SELECT
  USING (auth.uid() = user_id);

-- Staff can view venue ratings
CREATE POLICY "Staff can view venue ratings"
  ON public.order_ratings FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
    ) OR is_super_admin(auth.uid())
  );

-- Add awaiting_merchant_confirmation column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS awaiting_merchant_confirmation boolean DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_awaiting_confirmation 
  ON public.orders(venue_id, awaiting_merchant_confirmation) 
  WHERE awaiting_merchant_confirmation = true;