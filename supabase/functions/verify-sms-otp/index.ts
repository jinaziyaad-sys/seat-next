import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, userId } = await req.json();

    console.log('Verify SMS OTP request:', { code, userId });

    if (!code || !userId) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Code and user ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that the caller is the same user they're verifying OTP for
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify the caller is verifying OTP for themselves
    if (claimsData.claims.sub !== userId) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Forbidden: cannot verify OTP for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client for database operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile with verification code
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('verification_code, verification_code_expires_at, phone_verified')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('Error fetching profile:', fetchError);
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (profile.phone_verified) {
      return new Response(
        JSON.stringify({ success: true, verified: true, message: 'Phone already verified' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code exists
    if (!profile.verification_code) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'No verification code found. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code expired
    const expiresAt = new Date(profile.verification_code_expires_at);
    if (expiresAt < new Date()) {
      // Clear expired code
      await supabase
        .from('profiles')
        .update({
          verification_code: null,
          verification_code_expires_at: null,
        })
        .eq('id', userId);

      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Verification code expired. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify code
    if (profile.verification_code !== code) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Invalid verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code is valid - mark phone as verified
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        phone_verified: true,
        verification_code: null,
        verification_code_expires_at: null,
        verification_attempts: 0,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Failed to verify phone' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Phone verified successfully for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: true, 
        message: 'Phone verified successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-sms-otp:', error);
    return new Response(
      JSON.stringify({ success: false, verified: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
