-- Phase 1: Update database structure for three-app architecture

-- Step 1: Update app_role enum to include all needed roles
-- First, check and add missing roles
DO $$ 
BEGIN
    -- Add patron role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'patron') THEN
        ALTER TYPE app_role ADD VALUE 'patron';
    END IF;
    
    -- Add staff role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'staff') THEN
        ALTER TYPE app_role ADD VALUE 'staff';
    END IF;
    
    -- Add super_admin role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin') THEN
        ALTER TYPE app_role ADD VALUE 'super_admin';
    END IF;
END $$;

-- Step 2: Allow NULL venue_id for super_admins (they manage all venues)
ALTER TABLE public.user_roles ALTER COLUMN venue_id DROP NOT NULL;

-- Step 3: Update RLS policies for better isolation

-- Orders: Staff and admins can see orders for their venue
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;

CREATE POLICY "Staff can view venue orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
  OR auth.uid() = user_id
);

CREATE POLICY "Staff can update venue orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

-- Waitlist: Staff and admins can see waitlist for their venue
DROP POLICY IF EXISTS "Anyone can view waitlist entries" ON public.waitlist_entries;
DROP POLICY IF EXISTS "Anyone can update waitlist entries" ON public.waitlist_entries;

CREATE POLICY "Staff can view venue waitlist"
ON public.waitlist_entries
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
  OR auth.uid() = user_id
);

CREATE POLICY "Staff can update venue waitlist"
ON public.waitlist_entries
FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

-- User roles: Allow admins to view roles for their venue
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view venue roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  AND venue_id IN (SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Admins can insert venue roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND venue_id IN (SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Admins can delete venue roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND venue_id IN (SELECT venue_id FROM public.user_roles WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- Step 4: Create helper function to get user's venue
CREATE OR REPLACE FUNCTION public.get_user_venue(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT venue_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Step 5: Create helper function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;