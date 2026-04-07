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
    const { venueName, phone, displayAddress, address, latitude, longitude, serviceTypes, logoUrl, settings } = await req.json();

    if (!venueName || !venueName.trim()) {
      return new Response(
        JSON.stringify({ error: 'Venue name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate the caller
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

    const userId = claimsData.claims.sub as string;

    // Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already has a venue
    const { data: existingRoles } = await supabaseAdmin
      .from('user_roles')
      .select('venue_id')
      .eq('user_id', userId)
      .in('role', ['admin', 'staff']);

    if (existingRoles && existingRoles.length > 0) {
      return new Response(
        JSON.stringify({ error: 'You already have a venue. Please sign in instead.', venueId: existingRoles[0].venue_id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create venue
    const { data: venue, error: venueError } = await supabaseAdmin
      .from('venues')
      .insert({
        name: venueName.trim(),
        phone: phone?.trim() || null,
        display_address: displayAddress?.trim() || null,
        address: address?.trim() || null,
        latitude: latitude || null,
        longitude: longitude || null,
        service_types: serviceTypes || ['food_ready', 'table_ready'],
        logo_url: logoUrl || null,
        settings: settings || {},
        onboarding_completed: false,
      })
      .select('id')
      .single();

    if (venueError) {
      console.error('Venue creation error:', venueError);
      return new Response(
        JSON.stringify({ error: `Failed to create venue: ${venueError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, venue_id: venue.id, role: 'admin' });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      // Cleanup venue
      await supabaseAdmin.from('venues').delete().eq('id', venue.id);
      return new Response(
        JSON.stringify({ error: `Failed to assign admin role: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Self-registered merchant:', { userId, venueId: venue.id, venueName });

    return new Response(
      JSON.stringify({ success: true, venueId: venue.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Self-register error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
