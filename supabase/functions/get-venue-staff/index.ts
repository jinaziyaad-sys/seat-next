import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { venueId } = await req.json();

    if (!venueId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: venueId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate requester (function has verify_jwt=false)
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user: requester }, error: requesterError } = await supabaseAuth.auth.getUser();
    if (requesterError || !requester) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Permission check: venue admin OR super_admin
    const { data: requesterRoles, error: requesterRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, venue_id')
      .eq('user_id', requester.id);

    if (requesterRolesError) {
      console.error('Failed to read requester roles:', requesterRolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = (requesterRoles ?? []).some((r: any) => r.role === 'super_admin');
    const isVenueAdmin = (requesterRoles ?? []).some((r: any) => r.role === 'admin' && r.venue_id === venueId);

    if (!isSuperAdmin && !isVenueAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: venue admin required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('id, user_id, role, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (rolesError) {
      console.error('Failed to read staff roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to load staff' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userIds = (roles ?? []).map((r: any) => r.user_id).filter(Boolean);

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

    if (profilesError) {
      console.error('Failed to read staff profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to load staff details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const staff = (roles ?? []).map((r: any) => {
      const p = profileById.get(r.user_id);
      return {
        ...r,
        email: p?.email ?? 'Unknown',
        full_name: p?.full_name ?? '',
      };
    });

    return new Response(
      JSON.stringify({ staff }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Unexpected error in get-venue-staff function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
