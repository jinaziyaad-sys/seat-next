import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId required");

    const { data: campaign } = await supabase
      .from("promo_campaigns")
      .select("id, payment_status, review_status, venue_id")
      .eq("id", campaignId)
      .single();

    if (!campaign) throw new Error("Campaign not found");
    if (campaign.payment_status === "paid") {
      return new Response(JSON.stringify({ paid: true, alreadyPaid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search Stripe for a recent paid checkout session for this campaign
    const sessions = await stripe.checkout.sessions.list({ limit: 20 });
    const match = sessions.data.find(
      (s) => s.metadata?.campaign_id === campaignId && s.payment_status === "paid"
    );

    if (!match) {
      return new Response(JSON.stringify({ paid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentIntentId = typeof match.payment_intent === "string"
      ? match.payment_intent
      : (match.payment_intent as any)?.id || null;

    await supabase.from("promo_campaigns").update({
      payment_status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      ...(campaign.review_status === "approved" ? { is_active: true } : {}),
    }).eq("id", campaignId);

    return new Response(JSON.stringify({ paid: true, synced: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
