import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { referral_code, venue_id } = await req.json();

    if (!referral_code || !venue_id) {
      return new Response(
        JSON.stringify({ error: "referral_code and venue_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check referral config is active
    const { data: config } = await supabase
      .from("venue_referral_config")
      .select("*")
      .eq("venue_id", venue_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Referral program not active for this venue" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find the referral code
    const { data: refCode } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("code", referral_code.toUpperCase())
      .eq("venue_id", venue_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!refCode) {
      return new Response(
        JSON.stringify({ error: "Invalid referral code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Can't refer yourself
    if (refCode.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "You cannot use your own referral code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already completed for this referee+venue
    const { data: existing } = await supabase
      .from("referral_completions")
      .select("id")
      .eq("referee_id", user.id)
      .eq("venue_id", venue_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: "You have already used a referral for this venue",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create referral completion
    await supabase.from("referral_completions").insert({
      referrer_id: refCode.user_id,
      referee_id: user.id,
      venue_id,
      referrer_reward_type: config.referrer_reward_type,
      referrer_reward_value: config.referrer_reward_value,
      referee_reward_type: config.referee_reward_type,
      referee_reward_value: config.referee_reward_value,
      referrer_rewarded: true,
      referee_rewarded: true,
    });

    // Update uses count
    await supabase
      .from("referral_codes")
      .update({ uses_count: refCode.uses_count + 1 })
      .eq("id", refCode.id);

    // Credit referrer loyalty
    const { data: program } = await supabase
      .from("loyalty_programs")
      .select("*")
      .eq("venue_id", venue_id)
      .eq("is_active", true)
      .maybeSingle();

    if (program) {
      // Credit referrer
      await supabase
        .from("patron_loyalty")
        .upsert(
          {
            user_id: refCode.user_id,
            venue_id,
            program_id: program.id,
            stamps_count: 0,
            points_balance: 0,
            lifetime_stamps: 0,
            lifetime_points: 0,
          },
          { onConflict: "user_id,venue_id", ignoreDuplicates: true }
        );

      if (config.referrer_reward_type === "stamps") {
        const { error: creditError } = await supabase.rpc("credit_referral_stamps", {
          p_user_id: refCode.user_id,
          p_venue_id: venue_id,
          p_amount: config.referrer_reward_value,
        });
        if (creditError) {
          // Fallback: direct update
          await supabase
            .from("patron_loyalty")
            .update({
              stamps_count: refCode.uses_count + config.referrer_reward_value, // approximate
            })
            .eq("user_id", refCode.user_id)
            .eq("venue_id", venue_id);
        }
      }

      // Credit referee
      await supabase
        .from("patron_loyalty")
        .upsert(
          {
            user_id: user.id,
            venue_id,
            program_id: program.id,
            stamps_count: 0,
            points_balance: 0,
            lifetime_stamps: 0,
            lifetime_points: 0,
          },
          { onConflict: "user_id,venue_id", ignoreDuplicates: true }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Referral applied successfully!",
        referrer_reward: `${config.referrer_reward_value} ${config.referrer_reward_type}`,
        referee_reward: `${config.referee_reward_value} ${config.referee_reward_type}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
