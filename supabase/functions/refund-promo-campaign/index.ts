import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REFUND-PROMO] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaignId, reason } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    // Fetch campaign
    const { data: campaign, error: campError } = await supabase
      .from("promo_campaigns")
      .select("id, payment_status, stripe_payment_intent_id, title")
      .eq("id", campaignId)
      .single();

    if (campError || !campaign) throw new Error("Campaign not found");
    if (campaign.payment_status !== "paid") throw new Error("Campaign is not paid — no refund needed");
    if (!campaign.stripe_payment_intent_id) throw new Error("No payment intent ID stored — cannot refund automatically");

    logStep("Issuing refund", { campaignId, paymentIntent: campaign.stripe_payment_intent_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const refund = await stripe.refunds.create({
      payment_intent: campaign.stripe_payment_intent_id,
      reason: "requested_by_customer",
    });

    logStep("Refund created", { refundId: refund.id, status: refund.status });

    // Update campaign
    await supabase
      .from("promo_campaigns")
      .update({
        payment_status: "refunded",
        review_status: "rejected",
        review_notes: reason || "Rejected by admin — full refund issued",
        is_active: false,
      })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ success: true, refundId: refund.id }),
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
