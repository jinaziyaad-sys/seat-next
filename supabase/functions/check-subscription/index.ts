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

    // Accept optional venueId from request body
    let requestedVenueId: string | null = null;
    try {
      const body = await req.json();
      requestedVenueId = body?.venueId || null;
    } catch {
      // No body or not JSON - that's fine
    }

    // Get the user's venue_id from user_roles (use requested venue or first)
    let venueId: string | null = null;
    if (requestedVenueId) {
      // Verify user has access to this venue
      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("venue_id")
        .eq("user_id", user.id)
        .eq("venue_id", requestedVenueId)
        .maybeSingle();
      venueId = roleData?.venue_id || null;
    }
    if (!venueId) {
      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("venue_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      venueId = roleData?.venue_id || null;
    }
    logStep("User venue", { venueId, requestedVenueId });

    // Check for dev pricing override first
    if (venueId) {
      const { data: override } = await supabaseClient
        .from("dev_pricing_overrides")
        .select("*")
        .eq("venue_id", venueId)
        .maybeSingle();

      if (override && (!override.expires_at || new Date(override.expires_at) > new Date())) {
        logStep("Found active pricing override", { type: override.override_type });
        
        let simulatedProductIds: string[] = [];
        if (override.override_type === 'free_starter') {
          simulatedProductIds = ['prod_UHQvy6yev2Z4FJ'];
        } else if (override.override_type === 'free_pro') {
          simulatedProductIds = ['prod_UHQvBPLpLypA0e'];
        } else if (override.override_type === 'free_enterprise' || override.override_type === 'free') {
          simulatedProductIds = ['prod_UHQwZRXj29yoYZ'];
        }

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

    // Check if this venue already has a subscription record with a stripe_subscription_id
    // This ensures per-venue subscription isolation
    if (venueId) {
      const { data: existingSub } = await supabaseClient
        .from("merchant_subscriptions")
        .select("stripe_subscription_id, stripe_customer_id, status")
        .eq("venue_id", venueId)
        .maybeSingle();

      // If this venue has NO subscription record or no stripe_subscription_id,
      // check if the Stripe customer has a subscription and if it belongs to this venue
      if (!existingSub?.stripe_subscription_id) {
        // No subscription linked to this venue - check Stripe
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        
        if (customers.data.length === 0) {
          logStep("No Stripe customer found");
          return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const customerId = customers.data[0].id;
        // Check for active OR trialing subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 10,
        });

        const activeSubs = subscriptions.data.filter(
          (s: any) => s.status === 'active' || s.status === 'trialing'
        );

        if (activeSubs.length === 0) {
          logStep("No active Stripe subscription");
          return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Check if any subscription is already claimed by another venue
        const sub = activeSubs[0];
        const { data: claimedVenue } = await supabaseClient
          .from("merchant_subscriptions")
          .select("venue_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();

        if (claimedVenue && claimedVenue.venue_id !== venueId) {
          // This Stripe subscription belongs to a different venue
          logStep("Subscription belongs to different venue", { 
            subVenue: claimedVenue.venue_id, currentVenue: venueId 
          });
          return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Subscription is unclaimed or belongs to this venue - claim it
        const productIds = sub.items.data.map((item: any) => 
          typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
        ).filter(Boolean);
        const priceIds = sub.items.data.map((item: any) => item.price.id);
        const subscriptionEnd = safeTimestamp(sub.current_period_end);
        const subscriptionStart = safeTimestamp(sub.current_period_start);
        const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
        const subStatus = sub.status === 'trialing' ? 'trial' : 'active';
        const trialEnd = sub.trial_end ? safeTimestamp(sub.trial_end) : null;

        await syncSubscriptionToDb(supabaseClient, venueId, {
          status: subStatus,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan_id: await determinePlanIdFromDb(supabaseClient, productIds),
          current_period_start: subscriptionStart,
          current_period_end: subscriptionEnd,
          billing_cycle: interval === 'year' ? 'annual' : 'monthly',
          trial_ends_at: trialEnd,
        });

        logStep("Claimed subscription for venue", { venueId, subId: sub.id });

        return new Response(JSON.stringify({
          subscribed: true,
          status: subStatus,
          product_ids: productIds,
          price_ids: priceIds,
          subscription_end: subscriptionEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          trial_end: trialEnd,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Venue has a linked stripe_subscription_id - verify it's still active
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      try {
        const sub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
        
        if (sub.status === 'active' || sub.status === 'trialing') {
          const productIds = sub.items.data.map((item: any) => 
            typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
          ).filter(Boolean);
          const priceIds = sub.items.data.map((item: any) => item.price.id);
          const subscriptionEnd = safeTimestamp(sub.current_period_end);
          const subscriptionStart = safeTimestamp(sub.current_period_start);
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
          const retrievedStatus = sub.status === 'trialing' ? 'trial' : 'active';
          const trialEnd = sub.trial_end ? safeTimestamp(sub.trial_end) : null;

          await syncSubscriptionToDb(supabaseClient, venueId, {
            status: retrievedStatus,
            stripe_customer_id: existingSub.stripe_customer_id,
            stripe_subscription_id: sub.id,
            plan_id: await determinePlanIdFromDb(supabaseClient, productIds),
            current_period_start: subscriptionStart,
            current_period_end: subscriptionEnd,
            billing_cycle: interval === 'year' ? 'annual' : 'monthly',
            trial_ends_at: trialEnd,
          });

          return new Response(JSON.stringify({
            subscribed: true,
            status: retrievedStatus,
            product_ids: productIds,
            price_ids: priceIds,
            subscription_end: subscriptionEnd,
            stripe_customer_id: existingSub.stripe_customer_id,
            stripe_subscription_id: sub.id,
            trial_end: trialEnd,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else if (sub.status === 'past_due') {
          await syncSubscriptionToDb(supabaseClient, venueId, {
            status: 'past_due',
            stripe_customer_id: existingSub.stripe_customer_id,
            stripe_subscription_id: sub.id,
          });
          return new Response(JSON.stringify({ subscribed: false, status: 'past_due' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else {
          // Stored sub is cancelled/inactive — check if the customer has a newer active sub
          logStep("Stored sub is cancelled, checking for newer active subs", { storedSubId: existingSub.stripe_subscription_id });
          
          const customerSubs = await stripe.subscriptions.list({
            customer: existingSub.stripe_customer_id!,
            limit: 10,
          });
          const newerActiveSub = customerSubs.data.find(
            (s: any) => s.status === 'active' || s.status === 'trialing'
          );

          if (newerActiveSub) {
            // Check it's not already claimed by another venue
            const { data: claimedVenue } = await supabaseClient
              .from("merchant_subscriptions")
              .select("venue_id")
              .eq("stripe_subscription_id", newerActiveSub.id)
              .neq("venue_id", venueId)
              .maybeSingle();

            if (!claimedVenue) {
              // Claim this newer subscription for this venue
              const newProductIds = newerActiveSub.items.data.map((item: any) => 
                typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
              ).filter(Boolean);
              const newPriceIds = newerActiveSub.items.data.map((item: any) => item.price.id);
              const newEnd = safeTimestamp(newerActiveSub.current_period_end);
              const newStart = safeTimestamp(newerActiveSub.current_period_start);
              const newInterval = newerActiveSub.items?.data?.[0]?.price?.recurring?.interval;
              const newStatus = newerActiveSub.status === 'trialing' ? 'trial' : 'active';
              const newTrialEnd = newerActiveSub.trial_end ? safeTimestamp(newerActiveSub.trial_end) : null;

              await syncSubscriptionToDb(supabaseClient, venueId, {
                status: newStatus,
                stripe_customer_id: existingSub.stripe_customer_id,
                stripe_subscription_id: newerActiveSub.id,
                plan_id: await determinePlanIdFromDb(supabaseClient, newProductIds),
                current_period_start: newStart,
                current_period_end: newEnd,
                billing_cycle: newInterval === 'year' ? 'annual' : 'monthly',
                trial_ends_at: newTrialEnd,
              });

              logStep("Auto-recovered to newer subscription", { venueId, newSubId: newerActiveSub.id });

              return new Response(JSON.stringify({
                subscribed: true,
                status: newStatus,
                product_ids: newProductIds,
                price_ids: newPriceIds,
                subscription_end: newEnd,
                stripe_customer_id: existingSub.stripe_customer_id,
                stripe_subscription_id: newerActiveSub.id,
                trial_end: newTrialEnd,
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
          }

          // No active sub found — truly unsubscribed
          await syncSubscriptionToDb(supabaseClient, venueId, {
            status: 'none',
            stripe_customer_id: existingSub.stripe_customer_id,
          });
          return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } catch (stripeErr) {
        logStep("Error retrieving subscription from Stripe", { error: String(stripeErr) });
        // Subscription might have been deleted
        await syncSubscriptionToDb(supabaseClient, venueId, { status: 'none' });
        return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // No venue found - can't check subscription
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
    let dbPlanId = data.plan_id;
    if (dbPlanId && !dbPlanId.match(/^[0-9a-f-]{36}$/)) {
      const { data: planData } = await client
        .from("subscription_plans")
        .select("id")
        .ilike("name", `%${dbPlanId}%`)
        .limit(1)
        .maybeSingle();
      if (planData) dbPlanId = planData.id;
      else {
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
    if (data.trial_ends_at !== undefined) upsertData.trial_ends_at = data.trial_ends_at;

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

async function determinePlanIdFromDb(client: any, productIds: string[]): Promise<string> {
  try {
    const { data: plans } = await client
      .from("subscription_plans")
      .select("name, stripe_product_id, stripe_annual_product_id")
      .eq("is_active", true);

    if (plans) {
      for (const plan of plans) {
        const planProductIds = [plan.stripe_product_id, plan.stripe_annual_product_id].filter(Boolean);
        if (planProductIds.some((id: string) => productIds.includes(id))) {
          return plan.name.toLowerCase();
        }
      }
    }
  } catch (err) {
    logStep("Failed to load plans from DB for tier matching", { error: String(err) });
  }
  return 'starter';
}

// Legacy fallback kept for override logic
function determinePlanId(productIds: string[]): string {
  if (productIds.includes('prod_UHQwZRXj29yoYZ') || productIds.includes('prod_UHTdy0VRFEXVQe')) return 'enterprise';
  if (productIds.includes('prod_UHQvBPLpLypA0e') || productIds.includes('prod_UHRVAz3q59g5Vm')) return 'pro';
  if (productIds.includes('prod_UHQvy6yev2Z4FJ') || productIds.includes('prod_UHRVRONaVJns9q')) return 'starter';
  return 'starter';
}
