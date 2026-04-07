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
        
        // Look up the plan from DB by override type
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

        await syncSubscriptionToDb(supabaseClient, venueId, {
          status: 'active',
          stripe_subscription_id: null,
          stripe_customer_id: null,
          plan_id: overridePlan?.id || undefined,
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
          included_features: overridePlan?.included_features || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // ===== PayFast path: check local DB for PayFast subscriptions =====
    if (venueId) {
      const { data: pfSub } = await supabaseClient
        .from("merchant_subscriptions")
        .select("*, subscription_plans:plan_id(id, name, stripe_product_id, stripe_annual_product_id, included_features)")
        .eq("venue_id", venueId)
        .eq("payment_provider", "payfast")
        .maybeSingle();

      if (pfSub && (pfSub.status === 'active' || pfSub.status === 'trial')) {
        const plan = pfSub.subscription_plans as any;
        const productIds = plan ? [plan.stripe_product_id, plan.stripe_annual_product_id].filter(Boolean) : [];
        const trialEnd = pfSub.trial_ends_at;
        const isTrialing = pfSub.status === 'trial' && trialEnd && new Date(trialEnd) > new Date();

        // If trial has expired, mark as inactive
        if (pfSub.status === 'trial' && trialEnd && new Date(trialEnd) <= new Date()) {
          await supabaseClient
            .from("merchant_subscriptions")
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq("venue_id", venueId);
          logStep("PayFast trial expired", { venueId });
        } else {
          logStep("PayFast subscription active", { venueId, status: pfSub.status });
          return new Response(JSON.stringify({
            subscribed: true,
            status: isTrialing ? 'trial' : 'active',
            product_ids: productIds,
            price_ids: [],
            subscription_end: pfSub.current_period_end,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            trial_end: trialEnd,
            payment_provider: 'payfast',
            included_features: plan?.included_features || [],
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // ===== Stripe path =====
    if (venueId) {
      const { data: existingSub } = await supabaseClient
        .from("merchant_subscriptions")
        .select("stripe_subscription_id, stripe_customer_id, status, payment_provider")
        .eq("venue_id", venueId)
        .maybeSingle();

      // Skip Stripe check if this is a PayFast venue (already handled above)
      if (existingSub?.payment_provider === 'payfast') {
        // PayFast venue but not active/trial — return unsubscribed
        return new Response(JSON.stringify({ subscribed: false, status: existingSub.status === 'past_due' ? 'past_due' : 'none' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (!existingSub?.stripe_subscription_id) {
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

        const sub = activeSubs[0];
        const { data: claimedVenue } = await supabaseClient
          .from("merchant_subscriptions")
          .select("venue_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();

        if (claimedVenue && claimedVenue.venue_id !== venueId) {
          logStep("Subscription belongs to different venue", { 
            subVenue: claimedVenue.venue_id, currentVenue: venueId 
          });
          return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const productIds = sub.items.data.map((item: any) => 
          typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
        ).filter(Boolean);
        const priceIds = sub.items.data.map((item: any) => item.price.id);
        const subscriptionEnd = safeTimestamp(sub.current_period_end);
        const subscriptionStart = safeTimestamp(sub.current_period_start);
        const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
        const subStatus = sub.status === 'trialing' ? 'trial' : 'active';
        const trialEnd = sub.trial_end ? safeTimestamp(sub.trial_end) : null;

        const planId = await determinePlanIdFromDb(supabaseClient, productIds);
        await syncSubscriptionToDb(supabaseClient, venueId, {
          status: subStatus,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan_id: planId,
          current_period_start: subscriptionStart,
          current_period_end: subscriptionEnd,
          billing_cycle: interval === 'year' ? 'annual' : 'monthly',
          trial_ends_at: trialEnd,
        });

        // Load included_features for the plan
        const includedFeatures = await getIncludedFeatures(supabaseClient, planId);

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
          included_features: includedFeatures,
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
          // ── Upgrade discovery: check if a NEWER active sub exists for this venue ──
          let activeSub = sub;
          try {
            if (existingSub.stripe_customer_id) {
              const allSubs = await stripe.subscriptions.list({
                customer: existingSub.stripe_customer_id,
                limit: 20,
              });
              const activeOrTrialing = allSubs.data.filter(
                (s: any) => (s.status === 'active' || s.status === 'trialing') && s.id !== sub.id
              );
              // Find a newer sub for the same venue (by metadata) or any unclaimed newer sub
              const newerSub = activeOrTrialing.find((s: any) => {
                const sVenue = s.metadata?.venue_id;
                // Match if venue_id matches OR if it's unclaimed (no venue_id metadata but created after stored sub)
                return (sVenue === venueId || (!sVenue && s.created > sub.created));
              });
              if (newerSub) {
                // Verify it's not claimed by another venue
                const { data: claimedCheck } = await supabaseClient
                  .from("merchant_subscriptions")
                  .select("venue_id")
                  .eq("stripe_subscription_id", newerSub.id)
                  .neq("venue_id", venueId)
                  .maybeSingle();
                if (!claimedCheck) {
                  logStep("Found newer subscription, cancelling old one", {
                    oldSubId: sub.id,
                    newSubId: newerSub.id,
                  });
                  // Cancel the old subscription
                  await stripe.subscriptions.cancel(sub.id);
                  activeSub = newerSub;
                }
              }
            }
          } catch (upgradeErr) {
            logStep("Upgrade discovery check failed (non-fatal)", { error: String(upgradeErr) });
          }

          const productIds = activeSub.items.data.map((item: any) => 
            typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
          ).filter(Boolean);
          const priceIds = activeSub.items.data.map((item: any) => item.price.id);
          const subscriptionEnd = safeTimestamp(activeSub.current_period_end);
          const subscriptionStart = safeTimestamp(activeSub.current_period_start);
          const interval = activeSub.items?.data?.[0]?.price?.recurring?.interval;
          const retrievedStatus = activeSub.status === 'trialing' ? 'trial' : 'active';
          const trialEnd = activeSub.trial_end ? safeTimestamp(activeSub.trial_end) : null;

          const planId = await determinePlanIdFromDb(supabaseClient, productIds);
          await syncSubscriptionToDb(supabaseClient, venueId, {
            status: retrievedStatus,
            stripe_customer_id: existingSub.stripe_customer_id,
            stripe_subscription_id: activeSub.id,
            plan_id: planId,
            current_period_start: subscriptionStart,
            current_period_end: subscriptionEnd,
            billing_cycle: interval === 'year' ? 'annual' : 'monthly',
            trial_ends_at: trialEnd,
          });

          const includedFeatures = await getIncludedFeatures(supabaseClient, planId);

          return new Response(JSON.stringify({
            subscribed: true,
            status: retrievedStatus,
            product_ids: productIds,
            price_ids: priceIds,
            subscription_end: subscriptionEnd,
            stripe_customer_id: existingSub.stripe_customer_id,
            stripe_subscription_id: activeSub.id,
            trial_end: trialEnd,
            included_features: includedFeatures,
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
          // Stored sub is cancelled/inactive — check ALL customers for this email for a newer active sub
          logStep("Stored sub is cancelled, checking for newer active subs across all customers", { storedSubId: existingSub.stripe_subscription_id });
          
          // Search the stored customer first
          let newerActiveSub: any = null;
          let newerCustomerId: string | null = null;

          const customerSubs = await stripe.subscriptions.list({
            customer: existingSub.stripe_customer_id!,
            limit: 10,
          });
          newerActiveSub = customerSubs.data.find(
            (s: any) => s.status === 'active' || s.status === 'trialing'
          );
          if (newerActiveSub) {
            newerCustomerId = existingSub.stripe_customer_id!;
          }

          // If not found on stored customer, search ALL customers for this email (handles currency-change scenarios)
          if (!newerActiveSub) {
            logStep("No active sub on stored customer, searching all customers by email");
            const allCustomers = await stripe.customers.list({ email: user.email, limit: 10 });
            for (const cust of allCustomers.data) {
              if (cust.id === existingSub.stripe_customer_id) continue; // already checked
              const custSubs = await stripe.subscriptions.list({ customer: cust.id, limit: 10 });
              const found = custSubs.data.find((s: any) => {
                if (s.status !== 'active' && s.status !== 'trialing') return false;
                const sVenue = s.metadata?.venue_id;
                return sVenue === venueId || !sVenue; // Match venue or unclaimed
              });
              if (found) {
                newerActiveSub = found;
                newerCustomerId = cust.id;
                logStep("Found active sub on different customer", { customerId: cust.id, subId: found.id });
                break;
              }
            }
          }

          if (newerActiveSub && newerCustomerId) {
            const { data: claimedVenue } = await supabaseClient
              .from("merchant_subscriptions")
              .select("venue_id")
              .eq("stripe_subscription_id", newerActiveSub.id)
              .neq("venue_id", venueId)
              .maybeSingle();

            if (!claimedVenue) {
              const newProductIds = newerActiveSub.items.data.map((item: any) => 
                typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
              ).filter(Boolean);
              const newPriceIds = newerActiveSub.items.data.map((item: any) => item.price.id);
              const newEnd = safeTimestamp(newerActiveSub.current_period_end);
              const newStart = safeTimestamp(newerActiveSub.current_period_start);
              const newInterval = newerActiveSub.items?.data?.[0]?.price?.recurring?.interval;
              const newStatus = newerActiveSub.status === 'trialing' ? 'trial' : 'active';
              const newTrialEnd = newerActiveSub.trial_end ? safeTimestamp(newerActiveSub.trial_end) : null;

              const newPlanId = await determinePlanIdFromDb(supabaseClient, newProductIds);
              await syncSubscriptionToDb(supabaseClient, venueId, {
                status: newStatus,
                stripe_customer_id: newerCustomerId,
                stripe_subscription_id: newerActiveSub.id,
                plan_id: newPlanId,
                current_period_start: newStart,
                current_period_end: newEnd,
                billing_cycle: newInterval === 'year' ? 'annual' : 'monthly',
                trial_ends_at: newTrialEnd,
              });

              const includedFeatures = await getIncludedFeatures(supabaseClient, newPlanId);

              logStep("Auto-recovered to newer subscription", { venueId, newSubId: newerActiveSub.id, newCustomerId: newerCustomerId });

              return new Response(JSON.stringify({
                subscribed: true,
                status: newStatus,
                product_ids: newProductIds,
                price_ids: newPriceIds,
                subscription_end: newEnd,
                stripe_customer_id: newerCustomerId,
                stripe_subscription_id: newerActiveSub.id,
                trial_end: newTrialEnd,
                included_features: includedFeatures,
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
          }

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
        await syncSubscriptionToDb(supabaseClient, venueId, { status: 'none' });
        return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // No venue found
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
    const dbPlanId = data.plan_id;

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

// Returns the UUID plan_id from subscription_plans, matching by Stripe product IDs
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
          return plan.id; // Return UUID, not name
        }
      }
    }
  } catch (err) {
    logStep("Failed to load plans from DB for tier matching", { error: String(err) });
  }
  // Fallback: return first plan's UUID
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
  return 'starter'; // absolute last resort
}

// Helper to load included_features for a plan UUID
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
