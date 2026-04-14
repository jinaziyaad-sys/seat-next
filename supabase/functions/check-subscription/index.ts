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
    try {
      const body = await req.json();
      requestedVenueId = body?.venueId || null;
    } catch {
      // No body or not JSON - that's fine
    }

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
        logStep("Requested venue is not assigned to user", { requestedVenueId, userId: user.id });
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

    logStep("User venue", { venueId, requestedVenueId });

    if (venueId) {
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

    if (venueId) {
      const { data: existingSub } = await supabaseClient
        .from("merchant_subscriptions")
        .select("stripe_subscription_id, stripe_customer_id, status")
        .eq("venue_id", venueId)
        .maybeSingle();

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      if (!existingSub?.stripe_subscription_id) {
        const discoveredSub = await findVenueScopedStripeSubscription(
          stripe,
          supabaseClient,
          user.email,
          venueId
        );

        if (!discoveredSub) {
          logStep("No active Stripe subscription found for venue", { venueId });
          return new Response(JSON.stringify({ subscribed: false, status: 'none' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        const { customerId, subscription: sub } = discoveredSub;
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

        const includedFeatures = await getIncludedFeatures(supabaseClient, planId);

        logStep("Claimed venue-scoped subscription", { venueId, customerId, subId: sub.id });

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

      try {
        const sub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);

        if (sub.status === 'active' || sub.status === 'trialing') {
          let activeSub = sub;
          let activeCustomerId = existingSub.stripe_customer_id || (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null);

          try {
            const discoveredSub = await findVenueScopedStripeSubscription(
              stripe,
              supabaseClient,
              user.email,
              venueId,
              {
                preferredCustomerId: existingSub.stripe_customer_id,
                currentSubscriptionId: sub.id,
              }
            );

            if (discoveredSub) {
              activeSub = discoveredSub.subscription;
              activeCustomerId = discoveredSub.customerId;
            }

            if (discoveredSub && discoveredSub.subscription.id !== sub.id) {
              logStep("Found newer venue-scoped subscription, cancelling old one", {
                venueId,
                oldSubId: sub.id,
                newSubId: discoveredSub.subscription.id,
              });
              try {
                await stripe.subscriptions.cancel(sub.id);
              } catch (cancelErr) {
                logStep("Failed to cancel replaced subscription", { subId: sub.id, error: String(cancelErr) });
              }
            }
          } catch (upgradeErr) {
            logStep("Venue-scoped subscription discovery failed (non-fatal)", { error: String(upgradeErr) });
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
            stripe_customer_id: activeCustomerId,
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
            stripe_customer_id: activeCustomerId,
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
          logStep("Stored subscription is inactive, searching for another active venue-scoped subscription", {
            venueId,
            storedSubId: existingSub.stripe_subscription_id,
          });

          const recoveredSub = await findVenueScopedStripeSubscription(
            stripe,
            supabaseClient,
            user.email,
            venueId,
            {
              preferredCustomerId: existingSub.stripe_customer_id,
            }
          );

          if (recoveredSub) {
            const { customerId: recoveredCustomerId, subscription: newerActiveSub } = recoveredSub;
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
              stripe_customer_id: recoveredCustomerId,
              stripe_subscription_id: newerActiveSub.id,
              plan_id: newPlanId,
              current_period_start: newStart,
              current_period_end: newEnd,
              billing_cycle: newInterval === 'year' ? 'annual' : 'monthly',
              trial_ends_at: newTrialEnd,
            });

            const includedFeatures = await getIncludedFeatures(supabaseClient, newPlanId);

            logStep("Auto-recovered to venue-scoped subscription", {
              venueId,
              newSubId: newerActiveSub.id,
              newCustomerId: recoveredCustomerId,
            });

            return new Response(JSON.stringify({
              subscribed: true,
              status: newStatus,
              product_ids: newProductIds,
              price_ids: newPriceIds,
              subscription_end: newEnd,
              stripe_customer_id: recoveredCustomerId,
              stripe_subscription_id: newerActiveSub.id,
              trial_end: newTrialEnd,
              included_features: includedFeatures,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
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

async function findVenueScopedStripeSubscription(
  stripe: any,
  client: any,
  email: string,
  venueId: string,
  options?: {
    preferredCustomerId?: string | null;
    currentSubscriptionId?: string | null;
  }
): Promise<{ customerId: string; subscription: any } | null> {
  const customers = await stripe.customers.list({ email, limit: 20 });

  if (!customers.data.length) {
    return null;
  }

  const orderedCustomers = [
    ...customers.data.filter((customer: any) => customer.id === options?.preferredCustomerId),
    ...customers.data.filter((customer: any) => customer.id !== options?.preferredCustomerId),
  ];

  const candidates: Array<{
    customerId: string;
    subscription: any;
    matchScore: number;
    currentScore: number;
  }> = [];

  for (const customer of orderedCustomers) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 20,
    });

    for (const subscription of subscriptions.data) {
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        continue;
      }

      const metadataVenueId = subscription.metadata?.venue_id || null;
      const claimedVenueId = await getClaimedVenueForSubscription(client, subscription.id);

      if (claimedVenueId && claimedVenueId !== venueId) {
        continue;
      }

      const matchScore = metadataVenueId === venueId
        ? 3
        : claimedVenueId === venueId
          ? 2
          : 0;

      if (!matchScore) {
        continue;
      }

      candidates.push({
        customerId: customer.id,
        subscription,
        matchScore,
        currentScore: subscription.id === options?.currentSubscriptionId ? 1 : 0,
      });
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) =>
    b.matchScore - a.matchScore ||
    b.subscription.created - a.subscription.created ||
    b.currentScore - a.currentScore
  );

  const bestCandidate = candidates[0];
  return {
    customerId: bestCandidate.customerId,
    subscription: bestCandidate.subscription,
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
    logStep("Failed to load plans from DB for tier matching", { error: String(err) });
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
