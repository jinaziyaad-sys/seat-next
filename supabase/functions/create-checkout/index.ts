import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${d}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const body = await req.json();
    const { priceIds, venueId, successUrl, cancelUrl, currency, planId, billingCycle } = body;

    logStep("Creating checkout", { email: user.email, priceIds, venueId, currency, planId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    const checkoutCurrencyLower = (currency || "zar").toLowerCase();
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    let customerId: string | undefined;
    let existingCustomerCurrency: string | null = null;

    // Try to find a customer that matches the checkout currency
    for (const cust of customers.data) {
      customerId = cust.id;
      existingCustomerCurrency = (cust as any).currency?.toLowerCase() || null;
      if (!existingCustomerCurrency || existingCustomerCurrency === checkoutCurrencyLower) {
        break; // Use this customer — currency matches or is unset
      }
    }

    // If the only customer has a different currency, create a new one for this currency
    if (customerId && existingCustomerCurrency && existingCustomerCurrency !== checkoutCurrencyLower) {
      logStep("Currency mismatch — creating new customer", {
        existingCurrency: existingCustomerCurrency,
        checkoutCurrency: checkoutCurrencyLower,
      });
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = newCustomer.id;
      logStep("Created new customer for currency", { customerId });
    } else if (customerId) {
      logStep("Found existing customer", { customerId });
    }

    // Same-plan guard: reject if venue already has active subscription on this plan
    if (venueId && planId) {
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data: activeSub } = await supabaseService
        .from("merchant_subscriptions")
        .select("plan_id, status")
        .eq("venue_id", venueId)
        .in("status", ["active", "trial"])
        .maybeSingle();

      if (activeSub && activeSub.plan_id === planId) {
        logStep("Same-plan re-purchase blocked", { venueId, planId });
        return new Response(JSON.stringify({ error: "You are already on this plan. Choose a different plan to upgrade or downgrade." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // If venue already has an active subscription, reject — they should use change-plan instead
      if (activeSub) {
        logStep("Active subscription exists — use change-plan instead", { venueId });
        return new Response(JSON.stringify({ error: "You already have an active subscription. Use 'Change Plan' from your billing page instead." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    const checkoutCurrency = checkoutCurrencyLower;
    let lineItems: any[];

    if (priceIds && Array.isArray(priceIds) && priceIds.length > 0 && priceIds[0]) {
      // Use existing Stripe price IDs
      lineItems = priceIds.map((priceId: string) => ({
        price: priceId,
        quantity: 1,
      }));
    } else if (planId && currency && currency !== 'ZAR') {
      // No pre-existing Stripe price — use price_data with converted amount
      // Look up the plan to get ZAR price, then check for currency override
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data: plan } = await supabaseService
        .from("subscription_plans")
        .select("name, monthly_price, annual_price, stripe_product_id")
        .eq("id", planId)
        .single();

      if (!plan) throw new Error("Plan not found");

      // Check for currency override
      const { data: override } = await supabaseService
        .from("plan_currency_overrides")
        .select("monthly_price, annual_price, stripe_monthly_price_id, stripe_annual_price_id")
        .eq("plan_id", planId)
        .eq("currency", currency)
        .maybeSingle();

      if (override) {
        const overridePriceId = billingCycle === 'annual' ? override.stripe_annual_price_id : override.stripe_monthly_price_id;
        if (overridePriceId) {
          lineItems = [{ price: overridePriceId, quantity: 1 }];
        } else {
          // Override exists but no Stripe price ID — use price_data
          const amount = billingCycle === 'annual' ? override.annual_price : override.monthly_price;
          lineItems = [{
            price_data: {
              currency: checkoutCurrency,
              product: plan.stripe_product_id,
              unit_amount: Math.round(amount * 100),
              recurring: { interval: billingCycle === 'annual' ? 'year' : 'month' },
            },
            quantity: 1,
          }];
        }
      } else {
        // No override — fetch exchange rates and convert
        const { data: rateRow } = await supabaseService
          .from("exchange_rate_cache")
          .select("rate")
          .eq("base_currency", "ZAR")
          .eq("target_currency", currency)
          .maybeSingle();

        const rate = rateRow?.rate || 0.055; // fallback USD rate
        const zarPrice = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
        const convertedAmount = Math.round(zarPrice * rate * 100);

        lineItems = [{
          price_data: {
            currency: checkoutCurrency,
            product: plan.stripe_product_id,
            unit_amount: convertedAmount,
            recurring: { interval: billingCycle === 'annual' ? 'year' : 'month' },
          },
          quantity: 1,
        }];
      }
    } else {
      throw new Error("Either priceIds or planId with currency is required");
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "subscription",
      subscription_data: {
        metadata: {
          venue_id: venueId || '',
          user_id: user.id,
        },
      },
      success_url: successUrl || `${req.headers.get("origin")}/merchant/dashboard?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/merchant/signup?checkout=cancelled`,
      metadata: {
        user_id: user.id,
        venue_id: venueId || '',
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
