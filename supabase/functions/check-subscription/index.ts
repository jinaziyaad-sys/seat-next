import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
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

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get the user's venue_id from user_roles
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("venue_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const venueId = roleData?.venue_id;
    logStep("User venue", { venueId });

    // Check for dev pricing override first
    if (venueId) {
      const { data: override } = await supabaseClient
        .from("dev_pricing_overrides")
        .select("*")
        .eq("venue_id", venueId)
        .maybeSingle();

      if (override && (!override.expires_at || new Date(override.expires_at) > new Date())) {
        logStep("Found active pricing override", { type: override.override_type });
        
        // Determine which product to simulate based on override
        let simulatedProductIds: string[] = [];
        if (override.override_type === 'free_starter') {
          simulatedProductIds = ['prod_UHQvy6yev2Z4FJ']; // Starter
        } else if (override.override_type === 'free_pro') {
          simulatedProductIds = ['prod_UHQvBPLpLypA0e']; // Pro
        } else if (override.override_type === 'free_enterprise') {
          simulatedProductIds = ['prod_UHQwZRXj29yoYZ']; // Enterprise
        } else if (override.override_type === 'free') {
          simulatedProductIds = ['prod_UHQwZRXj29yoYZ']; // Default to Enterprise for free
        }

        // Sync to merchant_subscriptions
        await syncSubscriptionToDb(supabaseClient, venueId, {
          status: 'active',
          stripe_subscription_id: null,
          stripe_customer_id: null,
          plan_id: override.override_type,
          current_period_start: override.created_at,
          current_period_end: override.expires_at,
        });

        return new Response(JSON.stringify({
          subscribed: true,
          status: 'active',
          product_ids: simulatedProductIds,
          price_ids: [],
          subscription_end: override.expires_at,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          override: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      if (venueId) {
        await syncSubscriptionToDb(supabaseClient, venueId, { status: 'none' });
      }
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      const pastDueSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "past_due",
        limit: 1,
      });

      if (pastDueSubs.data.length > 0) {
        logStep("Found past_due subscription");
        if (venueId) {
          await syncSubscriptionToDb(supabaseClient, venueId, {
            status: 'past_due',
            stripe_customer_id: customerId,
            stripe_subscription_id: pastDueSubs.data[0].id,
          });
        }
        return new Response(JSON.stringify({ 
          subscribed: false, 
          status: 'past_due',
          message: 'Your subscription payment is overdue. Please update your payment method.'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("No active subscription");
      if (venueId) {
        await syncSubscriptionToDb(supabaseClient, venueId, {
          status: 'none',
          stripe_customer_id: customerId,
        });
      }
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const productIds = subscription.items.data.map((item: any) => item.price.product);
    const priceIds = subscription.items.data.map((item: any) => item.price.id);
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const subscriptionStart = new Date(subscription.current_period_start * 1000).toISOString();

    logStep("Active subscription found", { productIds, subscriptionEnd });

    // Write-through to merchant_subscriptions
    if (venueId) {
      await syncSubscriptionToDb(supabaseClient, venueId, {
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan_id: determinePlanId(productIds),
        current_period_start: subscriptionStart,
        current_period_end: subscriptionEnd,
        billing_cycle: determineBillingCycle(subscription),
      });
    }

    return new Response(JSON.stringify({
      subscribed: true,
      status: 'active',
      product_ids: productIds,
      price_ids: priceIds,
      subscription_end: subscriptionEnd,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
    }), {
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

// Helper: sync subscription state to merchant_subscriptions table
async function syncSubscriptionToDb(
  client: any,
  venueId: string,
  data: {
    status: string;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    plan_id?: string;
    current_period_start?: string | null;
    current_period_end?: string | null;
    billing_cycle?: string;
  }
) {
  try {
    // Look up the plan_id from subscription_plans table
    let dbPlanId = data.plan_id;
    if (dbPlanId && !dbPlanId.match(/^[0-9a-f-]{36}$/)) {
      // It's a tier name, look up the actual plan ID
      const { data: planData } = await client
        .from("subscription_plans")
        .select("id")
        .ilike("name", `%${dbPlanId}%`)
        .limit(1)
        .maybeSingle();
      if (planData) dbPlanId = planData.id;
      else {
        // Fallback: get any plan
        const { data: anyPlan } = await client
          .from("subscription_plans")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (anyPlan) dbPlanId = anyPlan.id;
      }
    }

    const upsertData: any = {
      venue_id: venueId,
      status: data.status === 'none' ? 'inactive' : data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.stripe_customer_id !== undefined) upsertData.stripe_customer_id = data.stripe_customer_id;
    if (data.stripe_subscription_id !== undefined) upsertData.stripe_subscription_id = data.stripe_subscription_id;
    if (dbPlanId) upsertData.plan_id = dbPlanId;
    if (data.current_period_start) upsertData.current_period_start = data.current_period_start;
    if (data.current_period_end) upsertData.current_period_end = data.current_period_end;
    if (data.billing_cycle) upsertData.billing_cycle = data.billing_cycle;

    // Check if record exists
    const { data: existing } = await client
      .from("merchant_subscriptions")
      .select("id")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (existing) {
      await client
        .from("merchant_subscriptions")
        .update(upsertData)
        .eq("venue_id", venueId);
    } else if (dbPlanId) {
      upsertData.plan_id = dbPlanId;
      await client
        .from("merchant_subscriptions")
        .insert(upsertData);
    }

    logStep("Synced subscription to DB", { venueId, status: data.status });
  } catch (err) {
    logStep("Failed to sync subscription to DB", { error: String(err) });
  }
}

function determinePlanId(productIds: string[]): string {
  if (productIds.includes('prod_UHQwZRXj29yoYZ')) return 'enterprise';
  if (productIds.includes('prod_UHQvBPLpLypA0e')) return 'pro';
  if (productIds.includes('prod_UHQvy6yev2Z4FJ')) return 'starter';
  return 'starter';
}

function determineBillingCycle(subscription: any): string {
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'annual' : 'monthly';
}
