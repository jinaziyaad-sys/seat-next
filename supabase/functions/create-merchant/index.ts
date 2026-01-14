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
    const { email, password, fullName, venueId, role = 'admin' } = await req.json();

    // Validate inputs
    if (!email || !password || !fullName || !venueId) {
      console.error('Missing required fields:', { email: !!email, password: !!password, fullName: !!fullName, venueId: !!venueId });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, fullName, and venueId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      console.error('Password too short');
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate requester (create-merchant has verify_jwt=false)
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

    if (!['admin', 'staff'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role (must be admin or staff)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client with service role key
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

    // Only venue admins (or super admins) can create staff for a venue
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

    console.log('Checking if user exists with email:', email);

    // First, check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      console.log('User already exists:', existingUser.id);
      userId = existingUser.id;

      // Ensure existing users can log in (confirm email if not confirmed)
      const isConfirmed = Boolean((existingUser as any)?.email_confirmed_at || (existingUser as any)?.confirmed_at);
      if (!isConfirmed) {
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });

        if (confirmError) {
          console.error('Failed to auto-confirm existing user:', confirmError);
        } else {
          console.log('Existing user email confirmed:', userId);
        }
      }
      // Check if user already has a role for this venue
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('venue_id', venueId)
        .maybeSingle();

      // Fetch all existing roles for this user to return in response
      const { data: allExistingRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role, venue_id, venues(name)')
        .eq('user_id', userId);

      if (existingRole) {
        // User already has a role at this specific venue
        const isConfirmed = Boolean((existingUser as any)?.email_confirmed_at || (existingUser as any)?.confirmed_at);
        let emailConfirmedUpdated = false;

        if (!isConfirmed) {
          const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email_confirm: true,
          });

          if (confirmError) {
            console.error('Failed to auto-confirm existing user:', confirmError);
          } else {
            emailConfirmedUpdated = true;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            userId: userId,
            email: email,
            isNewUser: false,
            alreadyAssigned: true,
            emailConfirmedUpdated,
            existingRoles: allExistingRoles || [],
            message: `User already has a role at this venue`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // User exists but doesn't have a role at this venue - we'll add them below
      console.log('Existing user will be assigned to new venue:', venueId);
    } else {
      // Create new user
      console.log('Creating new user with email:', email, 'and full name:', fullName);
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm so staff can log in immediately with shared password
        user_metadata: {
          full_name: fullName
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!authData.user) {
        console.error('No user data returned');
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      console.log('User created successfully:', userId);
    }

    // Insert user role with specified role (admin or staff) using service role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        venue_id: venueId,
        role: role, // Use the role from request (defaults to 'admin')
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      
      // Only cleanup if we just created this user
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Role assigned successfully for user:', userId, 'venue:', venueId);

    // Fetch updated roles to return
    const { data: updatedRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role, venue_id, venues(name)')
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userId,
        email: email,
        isNewUser: !existingUser,
        existingRoles: updatedRoles || [],
        message: existingUser 
          ? `User added to venue successfully (now has access to ${updatedRoles?.length || 1} venue(s))`
          : `New user created and assigned to venue`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in create-merchant function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
