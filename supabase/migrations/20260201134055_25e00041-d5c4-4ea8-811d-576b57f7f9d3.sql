-- Universal messages table for patron-merchant communication
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic reference (one of these will be set)
  waitlist_entry_id UUID REFERENCES public.waitlist_entries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Message details
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patron', 'venue', 'system')),
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  
  -- Read tracking
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure exactly one reference is set
  CONSTRAINT one_reference CHECK (
    (waitlist_entry_id IS NOT NULL AND order_id IS NULL) OR
    (waitlist_entry_id IS NULL AND order_id IS NOT NULL)
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_messages_waitlist ON public.messages(waitlist_entry_id) WHERE waitlist_entry_id IS NOT NULL;
CREATE INDEX idx_messages_order ON public.messages(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_messages_unread ON public.messages(read_at) WHERE read_at IS NULL;
CREATE INDEX idx_messages_created ON public.messages(created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Patrons can read messages for their own bookings
CREATE POLICY "Patrons can read their messages" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.waitlist_entries 
      WHERE id = messages.waitlist_entry_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = messages.order_id AND user_id = auth.uid()
    )
  );

-- Patrons can insert messages for their own bookings
CREATE POLICY "Patrons can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_type = 'patron' AND sender_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.waitlist_entries 
        WHERE id = messages.waitlist_entry_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.orders 
        WHERE id = messages.order_id AND user_id = auth.uid()
      )
    )
  );

-- Patrons can update read_at for messages sent to them
CREATE POLICY "Patrons can mark messages as read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.waitlist_entries 
      WHERE id = messages.waitlist_entry_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = messages.order_id AND user_id = auth.uid()
    )
  );

-- Venue staff can read messages for their venue's bookings
CREATE POLICY "Venue staff can read venue messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.waitlist_entries we ON we.venue_id = ur.venue_id
      WHERE we.id = messages.waitlist_entry_id AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.orders o ON o.venue_id = ur.venue_id
      WHERE o.id = messages.order_id AND ur.user_id = auth.uid()
    )
  );

-- Venue staff can insert messages for their venue's bookings
CREATE POLICY "Venue staff can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_type = 'venue' AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.waitlist_entries we ON we.venue_id = ur.venue_id
        WHERE we.id = messages.waitlist_entry_id AND ur.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.orders o ON o.venue_id = ur.venue_id
        WHERE o.id = messages.order_id AND ur.user_id = auth.uid()
      )
    )
  );

-- Venue staff can update read_at for messages sent to them
CREATE POLICY "Venue staff can mark messages as read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.waitlist_entries we ON we.venue_id = ur.venue_id
      WHERE we.id = messages.waitlist_entry_id AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.orders o ON o.venue_id = ur.venue_id
      WHERE o.id = messages.order_id AND ur.user_id = auth.uid()
    )
  );

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;