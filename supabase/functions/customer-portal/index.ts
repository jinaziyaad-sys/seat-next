import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer - first try via subscription record, then by email
    let customerId: string | null = null;

    // Look up venue_id for this user
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("venue_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.venue_id) {
      const { data: sub } = await supabaseClient
        .from("merchant_subscriptions")
        .select("stripe_customer_id")
        .eq("venue_id", roleData.venue_id)
        .maybeSingle();

      if (sub?.stripe_customer_id) {
        customerId = sub.stripe_customer_id;
        logStep("Found customer from subscription record", { customerId });
      }
    }

    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length === 0) throw new Error("No Stripe customer found");
      customerId = customers.data[0].id;
      logStep("Found customer by email", { customerId });
    }

    // Fetch available plans from DB to build portal config
    const { data: plans } = await supabaseClient
      .from("subscription_plans")
      .select("stripe_product_id, stripe_monthly_price_id, stripe_annual_price_id")
      .eq("is_active", true)
      .order("sort_order");

    // Build products config for the portal - allows switching between plans
    const products = (plans || [])
      .filter(p => p.stripe_product_id)
      .map(p => ({
        product: p.stripe_product_id,
        prices: [p.stripe_monthly_price_id, p.stripe_annual_price_id].filter(Boolean),
      }));

    logStep("Building portal config", { productCount: products.length });

    // Create a portal configuration that allows plan switching
    const portalConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Manage your subscription",
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          proration_behavior: "create_prorations",
          products: products.length > 0 ? products : undefined,
        },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
        },
        payment_method_update: {
          enabled: true,
        },
        invoice_history: {
          enabled: true,
        },
      },
    });

    logStep("Portal configuration created", { configId: portalConfig.id });

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: portalConfig.id,
      return_url: `${origin}/merchant/billing`,
    });

    logStep("Portal session created", { url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
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
