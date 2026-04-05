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
      // Without webhook secret, parse directly (dev/test mode)
      const body = await req.json();
      event = body as Stripe.Event;
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
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

          await supabase
            .from("merchant_subscriptions")
            .update({
              status,
              stripe_subscription_id: subscription.id,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
              trial_ends_at: trialEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", sub.venue_id);

          logStep("Subscription synced", { venueId: sub.venue_id, status });
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
