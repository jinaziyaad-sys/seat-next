import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staffRoleId, venueId } = await req.json();

    if (!staffRoleId || !venueId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: staffRoleId and venueId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate requester using getClaims() for secure JWT validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const requester = { id: claimsData.claims.sub as string };

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

    // Verify the role belongs to the venue
    const { data: roleToDelete, error: roleCheckError } = await supabaseAdmin
      .from('user_roles')
      .select('id, user_id, venue_id')
      .eq('id', staffRoleId)
      .eq('venue_id', venueId)
      .single();

    if (roleCheckError || !roleToDelete) {
      return new Response(
        JSON.stringify({ error: 'Staff role not found for this venue' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent deleting yourself
    if (roleToDelete.user_id === requester.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot remove yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the role
    const { error: deleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('id', staffRoleId);

    if (deleteError) {
      console.error('Failed to delete staff role:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to remove staff member' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Staff role deleted:', staffRoleId, 'by:', requester.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Unexpected error in delete-venue-staff function:', error);
    return new Response(
      JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
