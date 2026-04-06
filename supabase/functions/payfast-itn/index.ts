import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAYFAST-ITN] ${step}${d}`);
};

// PayFast valid IP ranges
const PAYFAST_IPS = [
  "197.97.145.144/28",
  "41.74.179.192/27",
];

const isValidPayFastIP = (ip: string): boolean => {
  // In production, validate against PAYFAST_IPS ranges
  // For now, log and allow (PayFast sandbox uses different IPs)
  logStep("Source IP", { ip });
  return true;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE");
    const body = await req.text();
    const params = new URLSearchParams(body);
    const pfData: Record<string, string> = {};
    params.forEach((v, k) => { pfData[k] = v; });

    logStep("ITN received", { payment_status: pfData.payment_status, m_payment_id: pfData.m_payment_id });

    // Validate signature
    const receivedSignature = pfData.signature;
    delete pfData.signature;

    const paramString = Object.entries(pfData)
      .filter(([_, v]) => v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
      .join("&");

    const signatureString = passphrase
      ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
      : paramString;

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(signatureString));
    const calculatedSignature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (calculatedSignature !== receivedSignature) {
      logStep("Invalid signature", { received: receivedSignature, calculated: calculatedSignature });
      return new Response("Invalid signature", { status: 400 });
    }

    logStep("Signature valid");

    const venueId = pfData.custom_str1;
    const planId = pfData.custom_str2;
    const billingCycle = pfData.custom_str3 || "monthly";
    const paymentStatus = pfData.payment_status;
    const pfPaymentId = pfData.pf_payment_id;
    const token = pfData.token; // subscription token for recurring

    if (!venueId || !planId) {
      logStep("Missing venue or plan ID");
      return new Response("Missing data", { status: 400 });
    }

    if (paymentStatus === "COMPLETE") {
      // Upsert subscription
      const { data: existing } = await supabase
        .from("merchant_subscriptions")
        .select("id")
        .eq("venue_id", venueId)
        .maybeSingle();

      const now = new Date();
      const periodEnd = new Date(now);
      if (billingCycle === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (existing) {
        await supabase
          .from("merchant_subscriptions")
          .update({
            status: "active",
            plan_id: planId,
            billing_cycle: billingCycle,
            payment_provider: "payfast",
            payfast_subscription_id: token || pfPaymentId,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("venue_id", venueId);
      } else {
        await supabase.from("merchant_subscriptions").insert({
          venue_id: venueId,
          plan_id: planId,
          status: "active",
          billing_cycle: billingCycle,
          payment_provider: "payfast",
          payfast_subscription_id: token || pfPaymentId,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });
      }

      // Create invoice
      const invoiceNumber = `PF-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("billing_invoices").insert({
        venue_id: venueId,
        invoice_number: invoiceNumber,
        amount: Math.round(parseFloat(pfData.amount_gross || "0") * 100),
        currency: "ZAR",
        status: "paid",
        paid_at: now.toISOString(),
        payfast_reference: pfPaymentId,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        subscription_id: existing?.id || null,
      });

      logStep("Subscription activated", { venueId, planId });
    } else if (paymentStatus === "CANCELLED") {
      await supabase
        .from("merchant_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId);

      logStep("Subscription cancelled", { venueId });
    } else if (paymentStatus === "FAILED") {
      await supabase
        .from("merchant_subscriptions")
        .update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId);

      logStep("Payment failed", { venueId });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(msg, { status: 500 });
  }
});
