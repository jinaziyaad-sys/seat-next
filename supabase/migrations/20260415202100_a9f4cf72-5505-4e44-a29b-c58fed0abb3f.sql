
-- Drop any existing insert policies on promo_campaigns
DROP POLICY IF EXISTS "Venue staff can insert promo campaigns" ON public.promo_campaigns;
DROP POLICY IF EXISTS "Venue admins can insert promo campaigns" ON public.promo_campaigns;
DROP POLICY IF EXISTS "Merchants can create campaigns" ON public.promo_campaigns;

-- Create admin-only insert policy
CREATE POLICY "Only venue admins can create promo campaigns"
ON public.promo_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (
    SELECT ur.venue_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
  OR is_super_admin(auth.uid())
);

-- Also ensure UPDATE is admin-only
DROP POLICY IF EXISTS "Venue staff can update promo campaigns" ON public.promo_campaigns;
DROP POLICY IF EXISTS "Merchants can update campaigns" ON public.promo_campaigns;
DROP POLICY IF EXISTS "Only venue admins can update promo campaigns" ON public.promo_campaigns;

CREATE POLICY "Only venue admins can update promo campaigns"
ON public.promo_campaigns
FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT ur.venue_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
  OR is_super_admin(auth.uid())
);
