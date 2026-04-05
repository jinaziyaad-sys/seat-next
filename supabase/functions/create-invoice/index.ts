import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-INVOICE] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
    if (!isAdmin) throw new Error("Access denied: super admin required");

    const { venueId, amountZar, description, notes } = await req.json();
    if (!venueId || !amountZar) throw new Error("venueId and amountZar are required");

    const amountCents = Math.round(amountZar * 100);
    if (amountCents <= 0) throw new Error("Amount must be positive");

    logStep("Creating invoice", { venueId, amountZar });

    // Get venue's stripe_customer_id from merchant_subscriptions
    const { data: sub } = await supabase
      .from("merchant_subscriptions")
      .select("stripe_customer_id")
      .eq("venue_id", venueId)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId = sub?.stripe_customer_id;

    // If no Stripe customer, look up by venue owner email
    if (!customerId) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("venue_id", venueId)
        .limit(1)
        .maybeSingle();

      if (roleData) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", roleData.user_id)
          .maybeSingle();

        if (profile?.email) {
          const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
          } else {
            const customer = await stripe.customers.create({ email: profile.email });
            customerId = customer.id;
          }
        }
      }
    }

    if (!customerId) throw new Error("Could not find or create Stripe customer for this venue");

    // Create invoice item
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: amountCents,
      currency: "zar",
      description: description || "Invoice from ReadyUp",
    });

    // Create and finalize the invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true, // Auto-send after finalization
      collection_method: "send_invoice",
      days_until_due: 7,
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    logStep("Invoice created in Stripe", { invoiceId: finalizedInvoice.id });

    // Write to billing_invoices table
    const invoiceNumber = finalizedInvoice.number || `INV-${Date.now().toString(36).toUpperCase()}`;

    const { error: dbError } = await supabase.from("billing_invoices").insert({
      venue_id: venueId,
      invoice_number: invoiceNumber,
      amount: amountCents,
      currency: "ZAR",
      status: "sent",
      notes: notes || null,
      stripe_invoice_id: finalizedInvoice.id,
      line_items: [{ description: description || "Invoice from ReadyUp", amount: amountCents }],
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      sent_at: new Date().toISOString(),
    });

    if (dbError) logStep("DB insert warning", { error: dbError.message });

    return new Response(JSON.stringify({
      success: true,
      invoice_id: finalizedInvoice.id,
      invoice_number: invoiceNumber,
      hosted_url: finalizedInvoice.hosted_invoice_url,
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
