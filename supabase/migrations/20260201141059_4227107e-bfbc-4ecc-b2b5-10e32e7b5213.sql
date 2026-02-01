-- Create venue_inquiries table for pre-booking patron-venue conversations
CREATE TABLE public.venue_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One active inquiry per user-venue pair
  UNIQUE(venue_id, user_id)
);

-- Add venue_inquiry_id to messages table
ALTER TABLE public.messages 
ADD COLUMN venue_inquiry_id UUID REFERENCES public.venue_inquiries(id) ON DELETE CASCADE;

-- Create index for inquiry messages
CREATE INDEX idx_messages_venue_inquiry ON public.messages(venue_inquiry_id) WHERE venue_inquiry_id IS NOT NULL;

-- Update the constraint to allow any one of three references
-- First drop old constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'one_reference') THEN
    ALTER TABLE public.messages DROP CONSTRAINT one_reference;
  END IF;
END $$;

-- Add new constraint allowing waitlist_entry_id, order_id, or venue_inquiry_id
ALTER TABLE public.messages ADD CONSTRAINT one_reference CHECK (
  (CASE WHEN waitlist_entry_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN venue_inquiry_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- Enable RLS on venue_inquiries
ALTER TABLE public.venue_inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for venue_inquiries

-- Patrons can view their own inquiries
CREATE POLICY "Patrons can view their own inquiries"
ON public.venue_inquiries
FOR SELECT
USING (auth.uid() = user_id);

-- Patrons can create their own inquiries
CREATE POLICY "Patrons can create their own inquiries"
ON public.venue_inquiries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Patrons can update their own inquiries (e.g., close them)
CREATE POLICY "Patrons can update their own inquiries"
ON public.venue_inquiries
FOR UPDATE
USING (auth.uid() = user_id);

-- Venue staff can view inquiries for their venue
CREATE POLICY "Venue staff can view venue inquiries"
ON public.venue_inquiries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.venue_id = venue_inquiries.venue_id 
    AND user_roles.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- RLS Policies for messages with venue_inquiry_id

-- Patrons can read their inquiry messages
CREATE POLICY "Patrons can read inquiry messages"
ON public.messages
FOR SELECT
USING (
  venue_inquiry_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.venue_inquiries 
    WHERE venue_inquiries.id = messages.venue_inquiry_id 
    AND venue_inquiries.user_id = auth.uid()
  )
);

-- Patrons can send inquiry messages
CREATE POLICY "Patrons can send inquiry messages"
ON public.messages
FOR INSERT
WITH CHECK (
  venue_inquiry_id IS NOT NULL AND
  sender_type = 'patron' AND
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.venue_inquiries 
    WHERE venue_inquiries.id = messages.venue_inquiry_id 
    AND venue_inquiries.user_id = auth.uid()
  )
);

-- Venue staff can read inquiry messages for their venue
CREATE POLICY "Venue staff can read venue inquiry messages"
ON public.messages
FOR SELECT
USING (
  venue_inquiry_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.venue_inquiries vi ON vi.venue_id = ur.venue_id
    WHERE vi.id = messages.venue_inquiry_id 
    AND ur.user_id = auth.uid()
  )
);

-- Venue staff can send inquiry messages
CREATE POLICY "Venue staff can send inquiry messages"
ON public.messages
FOR INSERT
WITH CHECK (
  venue_inquiry_id IS NOT NULL AND
  sender_type = 'venue' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.venue_inquiries vi ON vi.venue_id = ur.venue_id
    WHERE vi.id = messages.venue_inquiry_id 
    AND ur.user_id = auth.uid()
  )
);

-- Venue staff can mark inquiry messages as read
CREATE POLICY "Venue staff can mark inquiry messages as read"
ON public.messages
FOR UPDATE
USING (
  venue_inquiry_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.venue_inquiries vi ON vi.venue_id = ur.venue_id
    WHERE vi.id = messages.venue_inquiry_id 
    AND ur.user_id = auth.uid()
  )
);

-- Patrons can mark inquiry messages as read
CREATE POLICY "Patrons can mark inquiry messages as read"
ON public.messages
FOR UPDATE
USING (
  venue_inquiry_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.venue_inquiries 
    WHERE venue_inquiries.id = messages.venue_inquiry_id 
    AND venue_inquiries.user_id = auth.uid()
  )
);

-- Create trigger to update updated_at on venue_inquiries
CREATE TRIGGER update_venue_inquiries_updated_at
BEFORE UPDATE ON public.venue_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();