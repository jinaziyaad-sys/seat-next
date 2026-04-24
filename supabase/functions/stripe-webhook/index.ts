import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return new Response("STRIPE_SECRET_KEY not set", { status: 500 });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    let event: Stripe.Event;
    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) throw new Error("No stripe-signature header");
      const body = await req.text();
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      const body = await req.json();
      event = body as Stripe.Event;
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        // Handle promo campaign payments
        if (metadata.type === "promo_campaign" && metadata.campaign_id) {
          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as any)?.id || null;

          await supabase.from("promo_campaigns").update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntentId,
          }).eq("id", metadata.campaign_id);

          if (paymentIntentId) {
            const { data: camp } = await supabase
              .from("promo_campaigns")
              .select("review_status")
              .eq("id", metadata.campaign_id)
              .single();
            if (camp?.review_status === "approved") {
              await supabase.from("promo_campaigns").update({ is_active: true }).eq("id", metadata.campaign_id);
            }
          }
          logStep("Promo campaign payment completed", { campaignId: metadata.campaign_id });
          break;
        }

        // Handle subscription checkout — resolve venue from metadata
        if (session.mode === 'subscription' && metadata.venue_id) {
          const venueId = metadata.venue_id;
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as any)?.id || null;
          const customerId = typeof session.customer === 'string'
            ? session.customer
            : (session.customer as any)?.id || null;

          if (venueId && subscriptionId && customerId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            await upsertSubscription(supabase, venueId, sub, customerId);
            logStep("Subscription created from checkout", { venueId, subscriptionId });
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // RESOLVE VENUE FROM METADATA FIRST, then fallback to DB
        let venueId: string | null = subscription.metadata?.venue_id || null;

        if (!venueId) {
          // Fallback: find venue by subscription ID in DB
          const { data: subRow } = await supabase
            .from("merchant_subscriptions")
            .select("venue_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();
          venueId = subRow?.venue_id || null;
        }

        if (!venueId) {
          // Last resort: find by customer ID
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
          const { data: subRow } = await supabase
            .from("merchant_subscriptions")
            .select("venue_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          venueId = subRow?.venue_id || null;
        }

        if (venueId) {
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await upsertSubscription(supabase, venueId, subscription, 
              typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id);
            
            // Handle pending downgrade: if subscription renewed and there's a pending plan change
            if (subscription.status === 'active') {
              await applyPendingDowngrade(supabase, stripe, venueId, subscription);
            }
          } else {
            const status = subscription.status === 'past_due' ? 'past_due'
              : subscription.status === 'canceled' ? 'cancelled'
              : 'inactive';

            await supabase.from("merchant_subscriptions").update({
              status,
              stripe_subscription_id: subscription.id,
              cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
              updated_at: new Date().toISOString(),
            }).eq("venue_id", venueId);

            logStep("Subscription status updated", { venueId, status });
          }
        } else {
          logStep("No venue found for subscription", { subId: subscription.id });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const venueId = await resolveVenueFromInvoice(supabase, stripe, invoice);
        if (venueId) {
          await supabase.from("merchant_subscriptions")
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq("venue_id", venueId);
          logStep("Marked past_due", { venueId });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const venueId = await resolveVenueFromInvoice(supabase, stripe, invoice);
        if (venueId) {
          await supabase.from("merchant_subscriptions")
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq("venue_id", venueId);
          logStep("Marked active after payment", { venueId });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});

async function resolveVenueFromInvoice(supabase: any, stripe: any, invoice: any): Promise<string | null> {
  // Try subscription metadata first
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.metadata?.venue_id) return sub.metadata.venue_id;
    } catch {}
    
    const { data: subRow } = await supabase
      .from("merchant_subscriptions")
      .select("venue_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (subRow?.venue_id) return subRow.venue_id;
  }

  // Fallback to customer ID
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (customerId) {
    const { data: sub } = await supabase
      .from("merchant_subscriptions")
      .select("venue_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return sub?.venue_id || null;
  }
  return null;
}

function getPeriodTimestamps(sub: any): { start: number | null; end: number | null } {
  // Stripe API 2025-08-27.basil moved current_period_* to the item level.
  // Fallback to top-level for older payloads.
  const item = sub.items?.data?.[0];
  const start = sub.current_period_start ?? item?.current_period_start ?? null;
  const end = sub.current_period_end ?? item?.current_period_end ?? null;
  return { start, end };
}

async function upsertSubscription(supabase: any, venueId: string, sub: any, customerId: string) {
  const productIds = sub.items.data.map((item: any) =>
    typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
  ).filter(Boolean);
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const status = sub.status === 'trialing' ? 'trial' : 'active';
  const { start: periodStart, end: periodEnd } = getPeriodTimestamps(sub);

  let planId: string | null = null;
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("id, stripe_product_id, stripe_annual_product_id")
    .eq("is_active", true);

  if (plans) {
    for (const plan of plans) {
      const ids = [plan.stripe_product_id, plan.stripe_annual_product_id].filter(Boolean);
      if (ids.some((id: string) => productIds.includes(id))) {
        planId = plan.id;
        break;
      }
    }
  }
  if (!planId && plans?.length) planId = plans[0].id;

  const subData: any = {
    venue_id: venueId,
    status,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan_id: planId,
    billing_cycle: interval === 'year' ? 'annual' : 'monthly',
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    trial_ends_at: trialEnd,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("merchant_subscriptions")
    .select("id")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (existing) {
    await supabase.from("merchant_subscriptions").update(subData).eq("venue_id", venueId);
  } else {
    await supabase.from("merchant_subscriptions").insert(subData);
  }

  if (status === 'active' || status === 'trial') {
    await supabase
      .from("venues")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", venueId);
  }

  logStep("Subscription upserted", { venueId, status, planId });
}

async function applyPendingDowngrade(supabase: any, stripe: any, venueId: string, subscription: any) {
  const { data: dbSub } = await supabase
    .from("merchant_subscriptions")
    .select("pending_plan_id, pending_billing_cycle, pending_change_at")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!dbSub?.pending_plan_id) return;

  // Check if we've passed the pending_change_at date
  const pendingDate = new Date(dbSub.pending_change_at);
  const now = new Date();
  if (now < pendingDate) return;

  logStep("Applying pending downgrade", { venueId, pendingPlanId: dbSub.pending_plan_id });

  // Get the new plan's price ID
  const effectiveCycle = dbSub.pending_billing_cycle || 'monthly';
  const { data: newPlan } = await supabase
    .from("subscription_plans")
    .select("stripe_monthly_price_id, stripe_annual_price_id, name")
    .eq("id", dbSub.pending_plan_id)
    .maybeSingle();

  if (!newPlan) return;

  const newPriceId = effectiveCycle === 'annual' ? newPlan.stripe_annual_price_id : newPlan.stripe_monthly_price_id;
  if (!newPriceId) return;

  try {
    const currentItem = subscription.items.data[0];
    if (currentItem) {
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: currentItem.id, price: newPriceId }],
        proration_behavior: 'none',
      });
    }

    // Update DB: apply the downgrade and clear pending fields
    await supabase.from("merchant_subscriptions").update({
      plan_id: dbSub.pending_plan_id,
      billing_cycle: effectiveCycle,
      pending_plan_id: null,
      pending_billing_cycle: null,
      pending_change_at: null,
      updated_at: new Date().toISOString(),
    }).eq("venue_id", venueId);

    logStep("Pending downgrade applied", { venueId, newPlan: newPlan.name });
  } catch (err) {
    logStep("Failed to apply pending downgrade", { error: String(err) });
  }
}
