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
    const { venueName, phone, displayAddress, address, latitude, longitude, serviceTypes, logoUrl, settings, enableLoyalty } = await req.json();

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
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

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

    // Default venue settings (mirrors dev dashboard defaults)
    const DEFAULT_VENUE_SETTINGS = {
      business_hours: {
        monday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
        tuesday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
        wednesday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
        thursday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
        friday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
        saturday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
        sunday: { open: "09:00", close: "22:00", is_closed: true, breaks: [] }
      },
      holiday_closures: [],
      grace_periods: { last_reservation: 0, last_order: 15, last_waitlist_join: 30 },
      venue_capacity: 40,
      default_prep_time: 10,
      max_extension_time: 45,
      pickup_instructions: "Please collect your order from the main counter. Show your order number to staff.",
      auto_no_show_time: 15,
      order_number_refresh_minutes: 15,
      cob_time: "23:00",
      auto_cleanup_cancelled_waitlist: true,
      auto_cleanup_rejected: true,
      prep_time_mode: "analytics",
      table_configuration: [],
    };

    // Merge any custom settings from frontend with defaults
    const mergedSettings = { ...DEFAULT_VENUE_SETTINGS, ...(settings || {}) };

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
        settings: mergedSettings,
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

    // Auto-create loyalty program if requested (e.g., Enterprise plan selected with loyalty feature)
    if (enableLoyalty) {
      try {
        await supabaseAdmin.from('loyalty_programs').insert({
          venue_id: venue.id,
          type: 'stamp_card',
          is_active: true,
          admin_enabled: true,
          stamp_threshold: 10,
          earning_sources: ['order', 'waitlist'],
        });
        console.log('Loyalty program auto-created for venue:', venue.id);
      } catch (loyaltyErr) {
        // Non-blocking — venue is still created
        console.error('Loyalty auto-creation failed (non-blocking):', loyaltyErr);
      }
    }

    console.log('Self-registered merchant:', { userId, venueId: venue.id, venueName, enableLoyalty });

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
