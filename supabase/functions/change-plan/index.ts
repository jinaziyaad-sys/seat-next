import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHANGE-PLAN] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json();
    const { venueId, newPlanId, billingCycle, currency } = body;

    if (!venueId || !newPlanId) {
      throw new Error("venueId and newPlanId are required");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get current subscription from DB
    const { data: currentSub } = await supabaseService
      .from("merchant_subscriptions")
      .select("stripe_subscription_id, plan_id, status, billing_cycle")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (!currentSub?.stripe_subscription_id) {
      throw new Error("No active subscription found for this venue. Please subscribe first.");
    }

    if (!["active", "trial"].includes(currentSub.status)) {
      throw new Error("Subscription is not active. Please subscribe first.");
    }

    if (currentSub.plan_id === newPlanId) {
      return new Response(JSON.stringify({ error: "You are already on this plan." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get plan details
    const { data: plans } = await supabaseService
      .from("subscription_plans")
      .select("id, name, monthly_price, annual_price, sort_order, stripe_product_id, stripe_annual_product_id, stripe_monthly_price_id, stripe_annual_price_id")
      .eq("is_active", true);

    if (!plans) throw new Error("Could not load plans");

    const currentPlan = plans.find(p => p.id === currentSub.plan_id);
    const newPlan = plans.find(p => p.id === newPlanId);
    if (!newPlan) throw new Error("New plan not found");

    const isUpgrade = !currentPlan || newPlan.sort_order > (currentPlan?.sort_order ?? 0);

    logStep("Plan change", { from: currentPlan?.name, to: newPlan.name, isUpgrade });

    // Get the Stripe subscription
    const stripeSub = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);
    const currentItem = stripeSub.items.data[0];
    if (!currentItem) throw new Error("No subscription item found");

    // Determine new price ID
    const effectiveBillingCycle = billingCycle || currentSub.billing_cycle || 'monthly';
    let newPriceId: string | null = null;

    if (currency && currency !== 'ZAR') {
      const { data: override } = await supabaseService
        .from("plan_currency_overrides")
        .select("stripe_monthly_price_id, stripe_annual_price_id")
        .eq("plan_id", newPlanId)
        .eq("currency", currency)
        .maybeSingle();

      if (override) {
        newPriceId = effectiveBillingCycle === 'annual'
          ? override.stripe_annual_price_id
          : override.stripe_monthly_price_id;
      }
    }

    if (!newPriceId) {
      newPriceId = effectiveBillingCycle === 'annual'
        ? newPlan.stripe_annual_price_id
        : newPlan.stripe_monthly_price_id;
    }

    if (!newPriceId) {
      throw new Error("No Stripe price configured for this plan. Contact support.");
    }

    if (isUpgrade) {
      // UPGRADE: Apply immediately with proration
      logStep("Applying upgrade with proration");

      await stripe.subscriptions.update(currentSub.stripe_subscription_id, {
        items: [{ id: currentItem.id, price: newPriceId }],
        proration_behavior: 'always_invoice',
      });

      // Update DB immediately, clear any pending downgrade
      await supabaseService
        .from("merchant_subscriptions")
        .update({
          plan_id: newPlanId,
          billing_cycle: effectiveBillingCycle,
          pending_plan_id: null,
          pending_billing_cycle: null,
          pending_change_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId);

      logStep("Upgrade applied", { newPlan: newPlan.name });

      return new Response(JSON.stringify({
        success: true,
        type: 'upgrade',
        message: `Upgraded to ${newPlan.name}! The prorated difference has been charged.`,
        newPlan: newPlan.name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // DOWNGRADE: Schedule at period end using subscription_schedule
      // DON'T change the Stripe subscription or DB plan_id now — 
      // just record the pending change and let the webhook handle it at renewal
      logStep("Scheduling downgrade at period end");

      const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();

      // Store pending plan change in DB — current plan stays active
      await supabaseService
        .from("merchant_subscriptions")
        .update({
          pending_plan_id: newPlanId,
          pending_billing_cycle: effectiveBillingCycle,
          pending_change_at: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId);

      logStep("Downgrade scheduled", { newPlan: newPlan.name, effectiveAt: periodEnd });

      return new Response(JSON.stringify({
        success: true,
        type: 'downgrade',
        message: `Plan will change to ${newPlan.name} at the end of your current billing period (${new Date(periodEnd).toLocaleDateString()}).`,
        newPlan: newPlan.name,
        effectiveAt: periodEnd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
