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
  if (!stripeKey) {
    return new Response("STRIPE_SECRET_KEY not set", { status: 500 });
  }

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
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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

          await supabase
            .from("promo_campaigns")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntentId,
            })
            .eq("id", metadata.campaign_id);

          if (paymentIntentId) {
            const { data: camp } = await supabase
              .from("promo_campaigns")
              .select("review_status")
              .eq("id", metadata.campaign_id)
              .single();
            if (camp?.review_status === "approved") {
              await supabase
                .from("promo_campaigns")
                .update({ is_active: true })
                .eq("id", metadata.campaign_id);
            }
          }

          logStep("Promo campaign payment completed", { campaignId: metadata.campaign_id, paymentIntentId });
          break;
        }

        // Handle subscription checkout
        if (session.mode === 'subscription' && metadata.venue_id) {
          const venueId = metadata.venue_id;
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as any)?.id || null;
          const customerId = typeof session.customer === 'string'
            ? session.customer
            : (session.customer as any)?.id || null;

          if (venueId && subscriptionId && customerId) {
            // Get the subscription to determine the plan
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const productIds = sub.items.data.map((item: any) =>
              typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
            ).filter(Boolean);
            const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
            const trialEnd = sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null;
            const status = sub.status === 'trialing' ? 'trial' : 'active';

            // Find plan UUID from product IDs
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

            if (!planId && plans?.length) {
              planId = plans[0].id;
            }

            // Upsert merchant_subscriptions row
            const { data: existing } = await supabase
              .from("merchant_subscriptions")
              .select("id")
              .eq("venue_id", venueId)
              .maybeSingle();

            const subData = {
              venue_id: venueId,
              status,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan_id: planId,
              billing_cycle: interval === 'year' ? 'annual' : 'monthly',
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              trial_ends_at: trialEnd,
              updated_at: new Date().toISOString(),
            };

            if (existing) {
              await supabase
                .from("merchant_subscriptions")
                .update(subData)
                .eq("venue_id", venueId);
            } else {
              await supabase
                .from("merchant_subscriptions")
                .insert(subData);
            }

            logStep("Subscription created from checkout", { venueId, subscriptionId, status, planId });
          } else {
            logStep("Missing data for subscription checkout", { venueId, subscriptionId, customerId });
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer.id;

        // Find venue by stripe_customer_id
        const { data: sub } = await supabase
          .from("merchant_subscriptions")
          .select("venue_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (sub) {
          const status = subscription.status === 'active' ? 'active'
            : subscription.status === 'trialing' ? 'trial'
            : subscription.status === 'past_due' ? 'past_due'
            : subscription.status === 'canceled' ? 'cancelled'
            : 'inactive';

          const trialEnd = subscription.trial_end 
            ? new Date(subscription.trial_end * 1000).toISOString() 
            : null;

          // Also update plan_id if subscription items changed (plan switch)
          const productIds = subscription.items.data.map((item: any) =>
            typeof item.price.product === 'string' ? item.price.product : item.price.product?.id
          ).filter(Boolean);
          
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

          const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;

          const updateData: any = {
            status,
            stripe_subscription_id: subscription.id,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            trial_ends_at: trialEnd,
            updated_at: new Date().toISOString(),
            billing_cycle: interval === 'year' ? 'annual' : 'monthly',
          };
          if (planId) updateData.plan_id = planId;

          await supabase
            .from("merchant_subscriptions")
            .update(updateData)
            .eq("venue_id", sub.venue_id);

          logStep("Subscription synced", { venueId: sub.venue_id, status, planId });
        } else {
          logStep("No venue found for customer", { customerId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as any)?.id;

        if (customerId) {
          const { data: sub } = await supabase
            .from("merchant_subscriptions")
            .select("venue_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (sub) {
            await supabase
              .from("merchant_subscriptions")
              .update({ status: 'past_due', updated_at: new Date().toISOString() })
              .eq("venue_id", sub.venue_id);
            logStep("Marked past_due", { venueId: sub.venue_id });
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer as any)?.id;

        if (customerId) {
          const { data: sub } = await supabase
            .from("merchant_subscriptions")
            .select("venue_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (sub) {
            await supabase
              .from("merchant_subscriptions")
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq("venue_id", sub.venue_id);
            logStep("Marked active after payment", { venueId: sub.venue_id });
          }
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
