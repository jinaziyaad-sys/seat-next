import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PROMO-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { campaignId, successUrl, cancelUrl } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch campaign
    const { data: campaign, error: campError } = await adminClient
      .from("promo_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campError || !campaign) throw new Error("Campaign not found");

    // Only allow payment after approval
    if (campaign.review_status !== "approved") {
      throw new Error("Campaign must be approved before payment. Current status: " + (campaign.review_status || "pending"));
    }

    if (campaign.payment_status === "paid") {
      throw new Error("Campaign is already paid");
    }

    const amountInCents = Math.round((campaign.amount_charged || 0) * 100);
    if (amountInCents <= 0) throw new Error("Invalid campaign amount");

    logStep("Creating promo checkout", { campaignId, amount: amountInCents });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: "zar",
          product_data: {
            name: `Sponsored Ad: ${campaign.title}`,
            description: `Promotion campaign for ${campaign.placements?.join(", ") || "home"}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      metadata: {
        type: "promo_campaign",
        campaign_id: campaignId,
        venue_id: campaign.venue_id,
      },
      success_url: successUrl || `${req.headers.get("origin")}/merchant/dashboard?promo=success`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/merchant/dashboard?promo=cancelled`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
