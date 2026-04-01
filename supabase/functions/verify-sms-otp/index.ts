import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FAILED_ATTEMPTS = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, userId } = await req.json();

    if (!code || !userId) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Code and user ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate caller identity
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
    
    if (claimsData.claims.sub !== userId) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Forbidden: cannot verify OTP for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_verified')
      .eq('id', userId)
      .single();

    if (profile?.phone_verified) {
      return new Response(
        JSON.stringify({ success: true, verified: true, message: 'Phone already verified' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get verification code from server-only table
    const { data: verificationRecord, error: fetchError } = await supabase
      .from('verification_codes')
      .select('id, code, expires_at, attempts')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationRecord) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'No verification code found. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check brute force
    if (verificationRecord.attempts >= MAX_FAILED_ATTEMPTS) {
      await supabase
        .from('verification_codes')
        .delete()
        .eq('id', verificationRecord.id);

      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Too many failed attempts. Please request a new code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (new Date(verificationRecord.expires_at) < new Date()) {
      await supabase
        .from('verification_codes')
        .delete()
        .eq('id', verificationRecord.id);

      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Verification code expired. Please request a new code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify code
    if (verificationRecord.code !== code) {
      const newAttempts = verificationRecord.attempts + 1;
      await supabase
        .from('verification_codes')
        .update({ attempts: newAttempts })
        .eq('id', verificationRecord.id);

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      return new Response(
        JSON.stringify({ success: false, verified: false, message: `Invalid verification code. ${remaining} attempts remaining.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code is valid — mark phone as verified and delete the code
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ phone_verified: true })
      .eq('id', userId);

    // Clean up verification code
    await supabase
      .from('verification_codes')
      .delete()
      .eq('user_id', userId);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, verified: false, message: 'Failed to verify phone' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, verified: true, message: 'Phone verified successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-sms-otp:', error);
    return new Response(
      JSON.stringify({ success: false, verified: false, message: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
