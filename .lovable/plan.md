

# Fix: Merchant Sign-In Broken by Recursive RLS on user_roles

## Root Cause

The security migration (`20260331125721`) introduced a "Staff can view venue roles" RLS policy on `user_roles` that sub-selects from `user_roles` itself:

```sql
USING (
  venue_id IN (SELECT ur.venue_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
)
```

This creates **recursive RLS evaluation** — PostgreSQL must evaluate RLS policies on `user_roles` to execute the subquery inside the RLS policy on `user_roles`. This causes the query to fail or return empty results.

The auth logs confirm: login succeeds (HTTP 200), then the role check query returns nothing, and the code signs the user out immediately.

## Fix

Replace the recursive subquery policy with one that uses the existing `SECURITY DEFINER` function `get_user_venue()` (which bypasses RLS):

### Migration SQL

```sql
-- Drop the recursive policy
DROP POLICY IF EXISTS "Staff can view venue roles" ON public.user_roles;

-- Replace with a non-recursive version using security definer function
CREATE POLICY "Staff can view venue roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  venue_id = public.get_user_venue(auth.uid())
);
```

**Note**: `get_user_venue` is `SECURITY DEFINER` and `LIMIT 1`, so it won't recurse. However, it only returns one venue. For multi-venue staff, we should also fix the snapshot insert policies that have the same recursive pattern.

Also fix the two snapshot table policies that have the same recursive subquery issue:

```sql
DROP POLICY IF EXISTS "Staff can insert venue capacity snapshots" ON public.venue_capacity_snapshots;
DROP POLICY IF EXISTS "Staff can insert daily snapshots" ON public.daily_venue_snapshots;

CREATE POLICY "Staff can insert venue capacity snapshots"
ON public.venue_capacity_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  venue_id = public.get_user_venue(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Staff can insert daily snapshots"
ON public.daily_venue_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  venue_id = public.get_user_venue(auth.uid())
  OR public.is_super_admin(auth.uid())
);
```

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | Drop recursive policies, recreate using `get_user_venue()` security definer function |

No frontend code changes needed — the auth flow code is correct, it's the database policy blocking the query.

