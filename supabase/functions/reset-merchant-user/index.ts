import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Reset merchant user function invoked');
    
    const { userId, action } = await req.json();

    console.log('Request data:', { userId, action });

    // Validate input
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!action || !['confirm_email', 'send_password_reset', 'reset_all'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be confirm_email, send_password_reset, or reset_all' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Requester user ID:', user.id);

    // Check if requester is super_admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles || !roles.some(r => r.role === 'super_admin')) {
      console.error('User is not super_admin:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Only super admins can reset merchant user details' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User is super_admin, proceeding with action:', action);

    // Get the target user's email
    const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (targetUserError || !targetUserData?.user) {
      console.error('Failed to get target user:', targetUserError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUser = targetUserData.user;
    const results: { emailConfirmed?: boolean; passwordResetSent?: boolean } = {};

    // Confirm email action
    if (action === 'confirm_email' || action === 'reset_all') {
      const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

      if (confirmError) {
        console.error('Failed to confirm email:', confirmError);
        return new Response(
          JSON.stringify({ error: `Failed to confirm email: ${confirmError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      results.emailConfirmed = true;
      console.log('Email confirmed for user:', userId);
    }

    // Send password reset action
    if (action === 'send_password_reset' || action === 'reset_all') {
      if (!targetUser.email) {
        return new Response(
          JSON.stringify({ error: 'User has no email address' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate password reset link
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.email,
      });

      if (resetError) {
        console.error('Failed to generate password reset link:', resetError);
        return new Response(
          JSON.stringify({ error: `Failed to generate password reset: ${resetError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      results.passwordResetSent = true;
      console.log('Password reset link generated for user:', userId);

      // Return the reset link for the admin to share
      return new Response(
        JSON.stringify({
          success: true,
          message: action === 'reset_all' 
            ? 'Email confirmed and password reset link generated' 
            : 'Password reset link generated',
          ...results,
          resetLink: resetData?.properties?.action_link,
          userEmail: targetUser.email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email confirmed successfully',
        ...results,
        userEmail: targetUser.email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-merchant-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
