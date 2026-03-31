import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Rate limiting: max 3 requests per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('password_reset_requests')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .gte('created_at', oneHourAgo);

    if (count !== null && count >= 3) {
      // Still return success to not reveal rate limiting per email
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Your request has been submitted. An administrator will contact you with a new password.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find user by email in profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', email.toLowerCase())
      .single();

    let userId = profile?.id || null;
    let venueName = null;

    if (userId) {
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('venue_id, venues(name)')
        .eq('user_id', userId)
        .in('role', ['admin', 'staff'])
        .single();

      if (roleData?.venues) {
        venueName = (roleData.venues as any).name;
      }
    }

    const { error: insertError } = await supabaseAdmin
      .from('password_reset_requests')
      .insert({
        email: email.toLowerCase(),
        user_id: userId,
        venue_name: venueName,
        status: 'pending',
      });

    if (insertError) {
      console.error('Failed to create reset request:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit request. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your request has been submitted. An administrator will contact you with a new password.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in request-password-reset function:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
