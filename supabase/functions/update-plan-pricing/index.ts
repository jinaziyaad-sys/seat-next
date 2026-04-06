import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-PLAN-PRICING] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Verify the caller is a super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleData) throw new Error("Access denied: super admin required");

    const body = await req.json();
    const { planId, newMonthlyPrice, newAnnualPrice } = body;

    if (!planId) throw new Error("planId is required");
    if (newMonthlyPrice == null && newAnnualPrice == null) {
      throw new Error("At least one of newMonthlyPrice or newAnnualPrice is required");
    }

    logStep("Updating pricing", { planId, newMonthlyPrice, newAnnualPrice });

    // Fetch current plan from DB
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (planError || !plan) throw new Error("Plan not found");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const updates: Record<string, any> = {};

    // Update monthly price if changed
    if (newMonthlyPrice != null && newMonthlyPrice !== plan.monthly_price) {
      const productId = plan.stripe_product_id;
      if (!productId) throw new Error("Plan has no stripe_product_id configured");

      // Create new Stripe price (prices are immutable)
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(newMonthlyPrice * 100), // Convert to cents
        currency: "zar",
        recurring: { interval: "month" },
      });
      logStep("Created new monthly price", { priceId: newPrice.id });

      // Archive old price if it exists
      if (plan.stripe_monthly_price_id) {
        await stripe.prices.update(plan.stripe_monthly_price_id, { active: false });
        logStep("Archived old monthly price", { oldPriceId: plan.stripe_monthly_price_id });
      }

      updates.monthly_price = newMonthlyPrice;
      updates.stripe_monthly_price_id = newPrice.id;
    }

    // Update annual price if changed
    if (newAnnualPrice != null && newAnnualPrice !== plan.annual_price) {
      const productId = plan.stripe_annual_product_id || plan.stripe_product_id;
      if (!productId) throw new Error("Plan has no stripe product ID configured for annual");

      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(newAnnualPrice * 100),
        currency: "zar",
        recurring: { interval: "year" },
      });
      logStep("Created new annual price", { priceId: newPrice.id });

      if (plan.stripe_annual_price_id) {
        await stripe.prices.update(plan.stripe_annual_price_id, { active: false });
        logStep("Archived old annual price", { oldPriceId: plan.stripe_annual_price_id });
      }

      updates.annual_price = newAnnualPrice;
      updates.stripe_annual_price_id = newPrice.id;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No changes needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the subscription_plans table
    updates.updated_at = new Date().toISOString();
    const { error: updateError } = await supabaseClient
      .from("subscription_plans")
      .update(updates)
      .eq("id", planId);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    logStep("Plan updated successfully", updates);

    return new Response(JSON.stringify({
      success: true,
      updated: updates,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
