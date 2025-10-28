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
    const { phone, userId } = await req.json();

    console.log('Send SMS OTP request:', { phone, userId });

    if (!phone || !userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone number and user ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting - max 3 SMS per hour
    const { data: profile } = await supabase
      .from('profiles')
      .select('verification_attempts, last_verification_sent_at')
      .eq('id', userId)
      .single();

    if (profile?.last_verification_sent_at) {
      const lastSent = new Date(profile.last_verification_sent_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastSent > oneHourAgo && profile.verification_attempts >= 3) {
        return new Response(
          JSON.stringify({ success: false, message: 'Too many verification attempts. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset attempts if more than an hour has passed
      if (lastSent < oneHourAgo) {
        await supabase
          .from('profiles')
          .update({ verification_attempts: 0 })
          .eq('id', userId);
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    console.log('Generated OTP:', otp, 'expires at:', expiresAt);

    // Store OTP in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        verification_code: otp,
        verification_code_expires_at: expiresAt.toISOString(),
        verification_attempts: (profile?.verification_attempts || 0) + 1,
        last_verification_sent_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error storing OTP:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to store verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const message = `Your verification code is: ${otp}. This code expires in 5 minutes.`;

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioPhoneNumber,
        To: phone,
        Body: message,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to send SMS', error: twilioData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent successfully',
        messageSid: twilioData.sid 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-sms-otp:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
