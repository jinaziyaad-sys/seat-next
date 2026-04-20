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

function safeTimestamp(ts: any): string | null {
  if (!ts) return null;
  try {
    const num = typeof ts === 'number' ? ts : Number(ts);
    if (isNaN(num)) return null;
    const d = new Date(num * 1000);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

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

    let requestedVenueId: string | null = null;
    let forceRefresh = false;
    try {
      const body = await req.json();
      requestedVenueId = body?.venueId || null;
      forceRefresh = body?.forceRefresh === true;
    } catch {}

    // Resolve venue
    let venueId: string | null = null;
    if (requestedVenueId) {
      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("venue_id")
        .eq("user_id", user.id)
        .eq("venue_id", requestedVenueId)
        .limit(1)
        .maybeSingle();

      if (!roleData?.venue_id) {
        return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      venueId = roleData.venue_id;
    } else {
      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("venue_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      venueId = roleData?.venue_id || null;
    }

    logStep("User venue", { venueId });

    if (!venueId) {
      return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check dev pricing override first
    const { data: override } = await supabaseClient
      .from("dev_pricing_overrides")
      .select("*")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (override && (!override.expires_at || new Date(override.expires_at) > new Date())) {
      logStep("Found active pricing override", { type: override.override_type });

      const overridePlanName = override.override_type.replace('free_', '');
      const { data: overridePlan } = await supabaseClient
        .from("subscription_plans")
        .select("id, stripe_product_id, stripe_annual_product_id, included_features")
        .ilike("name", `%${overridePlanName}%`)
        .limit(1)
        .maybeSingle();

      const simulatedProductIds = overridePlan
        ? [overridePlan.stripe_product_id, overridePlan.stripe_annual_product_id].filter(Boolean)
        : [];

      return new Response(JSON.stringify({
        subscribed: true,
        status: 'active',
        product_ids: simulatedProductIds,
        price_ids: [],
        subscription_end: override.expires_at,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        override: true,
        included_features: overridePlan?.included_features || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ========== DB-FIRST: Read current subscription from database ==========
    const { data: dbSub } = await supabaseClient
      .from("merchant_subscriptions")
      .select("*")
      .eq("venue_id", venueId)
      .maybeSingle();

    // If we have a valid DB record with active/trial status and NOT forcing refresh,
    // return it immediately without hitting Stripe
    if (dbSub && ['active', 'trial'].includes(dbSub.status) && !forceRefresh) {
      const planId = dbSub.plan_id;
      const includedFeatures = await getIncludedFeatures(supabaseClient, planId);

      await supabaseClient
        .from("venues")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", venueId);

      // Determine product_ids from plan
      const { data: planData } = await supabaseClient
        .from("subscription_plans")
        .select("stripe_product_id, stripe_annual_product_id")
        .eq("id", planId)
        .maybeSingle();

      const productIds = planData
        ? [planData.stripe_product_id, planData.stripe_annual_product_id].filter(Boolean)
        : [];

      logStep("DB-first response (no Stripe call)", { venueId, status: dbSub.status, planId });

      return new Response(JSON.stringify({
        subscribed: true,
        status: dbSub.status === 'trial' ? 'trial' : 'active',
        product_ids: productIds,
        price_ids: [],
        subscription_end: dbSub.current_period_end,
        trial_end: dbSub.trial_ends_at,
        stripe_customer_id: dbSub.stripe_customer_id,
        stripe_subscription_id: dbSub.stripe_subscription_id,
        included_features: includedFeatures,
        pending_plan_id: dbSub.pending_plan_id,
        pending_change_at: dbSub.pending_change_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If DB says past_due, return that without Stripe check
    if (dbSub && dbSub.status === 'past_due' && !forceRefresh) {
      logStep("DB-first: past_due", { venueId });
      return new Response(JSON.stringify({ subscribed: false, status: 'past_due' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ========== STRIPE RECONCILIATION (only for missing/inactive/forceRefresh) ==========
    logStep("Performing Stripe reconciliation", { venueId, forceRefresh, dbStatus: dbSub?.status });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If we have a stored subscription ID, check it directly first
    if (dbSub?.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(dbSub.stripe_subscription_id);

        if (sub.status === 'active' || sub.status === 'trialing') {
          const result = await syncAndReturn(supabaseClient, stripe, venueId, sub, dbSub.stripe_customer_id);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        if (sub.status === 'past_due') {
          await syncSubscriptionToDb(supabaseClient, venueId, {
            status: 'past_due',
            stripe_customer_id: dbSub.stripe_customer_id,
            stripe_subscription_id: sub.id,
          });
          return new Response(JSON.stringify({ subscribed: false, status: 'past_due' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Subscription is canceled/incomplete — fall through to search
        logStep("Stored subscription inactive", { subId: sub.id, status: sub.status });
      } catch (stripeErr) {
        // Stripe retrieval failed — DON'T overwrite to none, just log
        logStep("Stripe retrieve failed (non-destructive)", { error: String(stripeErr) });
        
        // If DB had an active state, return it as-is rather than destroying it
        if (dbSub && ['active', 'trial'].includes(dbSub.status)) {
          const includedFeatures = await getIncludedFeatures(supabaseClient, dbSub.plan_id);
          const { data: planData } = await supabaseClient
            .from("subscription_plans")
            .select("stripe_product_id, stripe_annual_product_id")
            .eq("id", dbSub.plan_id)
            .maybeSingle();
          const productIds = planData
            ? [planData.stripe_product_id, planData.stripe_annual_product_id].filter(Boolean)
            : [];

          return new Response(JSON.stringify({
            subscribed: true,
            status: dbSub.status,
            product_ids: productIds,
            price_ids: [],
            subscription_end: dbSub.current_period_end,
            stripe_customer_id: dbSub.stripe_customer_id,
            stripe_subscription_id: dbSub.stripe_subscription_id,
            included_features: includedFeatures,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // Search for venue-scoped subscription across all customers
    const customers = await stripe.customers.list({ email: user.email, limit: 20 });

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 20 });
      for (const sub of subs.data) {
        if (sub.status !== 'active' && sub.status !== 'trialing') continue;
        if (sub.metadata?.venue_id !== venueId) continue;

        // Check not claimed by another venue
        const claimed = await getClaimedVenueForSubscription(supabaseClient, sub.id);
        if (claimed && claimed !== venueId) continue;

        const result = await syncAndReturn(supabaseClient, stripe, venueId, sub, customer.id);
        logStep("Discovered venue-scoped subscription", { venueId, subId: sub.id });
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Stripe scan succeeded but found nothing active — correct stale DB state
    if (dbSub && ['active', 'trial'].includes(dbSub.status)) {
      logStep("Stripe scan found no active sub — correcting stale DB state to inactive", { venueId });
      await syncSubscriptionToDb(supabaseClient, venueId, {
        status: 'inactive',
        stripe_customer_id: dbSub.stripe_customer_id,
        stripe_subscription_id: dbSub.stripe_subscription_id,
      });
    } else {
      logStep("No subscription found, returning none", { venueId });
    }

    return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
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

async function syncAndReturn(
  client: any,
  stripe: any,
  venueId: string,
  sub: any,
  customerId: string | null,
) {
  const productIds = sub.items.data.map((item: any) =>
    typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
  ).filter(Boolean);
  const priceIds = sub.items.data.map((item: any) => item.price.id);
  const subscriptionEnd = safeTimestamp(sub.current_period_end);
  const subscriptionStart = safeTimestamp(sub.current_period_start);
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  const status = sub.status === 'trialing' ? 'trial' : 'active';
  const trialEnd = sub.trial_end ? safeTimestamp(sub.trial_end) : null;
  const actualCustomerId = customerId || (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null);

  const planId = await determinePlanIdFromDb(client, productIds);
  await syncSubscriptionToDb(client, venueId, {
    status,
    stripe_customer_id: actualCustomerId,
    stripe_subscription_id: sub.id,
    plan_id: planId,
    current_period_start: subscriptionStart,
    current_period_end: subscriptionEnd,
    billing_cycle: interval === 'year' ? 'annual' : 'monthly',
    trial_ends_at: trialEnd,
  });

  const includedFeatures = await getIncludedFeatures(client, planId);

  return {
    subscribed: true,
    status,
    product_ids: productIds,
    price_ids: priceIds,
    subscription_end: subscriptionEnd,
    stripe_customer_id: actualCustomerId,
    stripe_subscription_id: sub.id,
    trial_end: trialEnd,
    included_features: includedFeatures,
  };
}

async function getClaimedVenueForSubscription(client: any, subscriptionId: string): Promise<string | null> {
  const { data } = await client
    .from("merchant_subscriptions")
    .select("venue_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();
  return data?.venue_id || null;
}

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
    trial_ends_at?: string | null;
  }
) {
  try {
    const upsertData: any = {
      venue_id: venueId,
      status: data.status === 'none' ? 'inactive' : data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.stripe_customer_id !== undefined) upsertData.stripe_customer_id = data.stripe_customer_id;
    if (data.stripe_subscription_id !== undefined) upsertData.stripe_subscription_id = data.stripe_subscription_id;
    if (data.plan_id) upsertData.plan_id = data.plan_id;
    if (data.current_period_start) upsertData.current_period_start = data.current_period_start;
    if (data.current_period_end) upsertData.current_period_end = data.current_period_end;
    if (data.billing_cycle) upsertData.billing_cycle = data.billing_cycle;
    if (data.trial_ends_at !== undefined) upsertData.trial_ends_at = data.trial_ends_at;

    const { data: existing } = await client
      .from("merchant_subscriptions")
      .select("id")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (existing) {
      await client.from("merchant_subscriptions").update(upsertData).eq("venue_id", venueId);
    } else if (data.plan_id) {
      await client.from("merchant_subscriptions").insert(upsertData);
    }

    if (['active', 'trial'].includes(data.status)) {
      await client
        .from("venues")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", venueId);
    }

    logStep("Synced subscription to DB", { venueId, status: data.status });
  } catch (err) {
    logStep("Failed to sync subscription to DB", { error: String(err) });
  }
}

async function determinePlanIdFromDb(client: any, productIds: string[]): Promise<string> {
  try {
    const { data: plans } = await client
      .from("subscription_plans")
      .select("id, stripe_product_id, stripe_annual_product_id")
      .eq("is_active", true);

    if (plans) {
      for (const plan of plans) {
        const planProductIds = [plan.stripe_product_id, plan.stripe_annual_product_id].filter(Boolean);
        if (planProductIds.some((id: string) => productIds.includes(id))) {
          return plan.id;
        }
      }
    }
  } catch (err) {
    logStep("Failed to load plans", { error: String(err) });
  }

  try {
    const { data: fallback } = await client
      .from("subscription_plans")
      .select("id")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (fallback) return fallback.id;
  } catch {}

  return 'starter';
}

async function getIncludedFeatures(client: any, planId: string): Promise<string[]> {
  try {
    if (!planId || !planId.match(/^[0-9a-f-]{36}$/)) return [];
    const { data } = await client
      .from("subscription_plans")
      .select("included_features")
      .eq("id", planId)
      .maybeSingle();
    return data?.included_features || [];
  } catch {
    return [];
  }
}
