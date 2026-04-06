import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { createHash } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAYFAST-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE");

    if (!merchantId || !merchantKey) {
      throw new Error("PayFast credentials not configured");
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { planId, billingCycle, returnUrl, cancelUrl } = await req.json();
    if (!planId) throw new Error("planId is required");

    logStep("Generating PayFast form", { email: user.email, planId, billingCycle });

    // Fetch plan details
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) throw new Error("Plan not found");

    // Get venue for this user
    const { data: role } = await adminClient
      .from("user_roles")
      .select("venue_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!role?.venue_id) throw new Error("No venue found for user");

    const isAnnual = billingCycle === "annual";
    const amount = isAnnual ? plan.annual_price : plan.monthly_price;
    const frequency = isAnnual ? "6" : "3"; // 6 = yearly, 3 = monthly in PayFast

    // Build PayFast payment data
    const pfData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl || `${req.headers.get("origin") || "https://app.example.com"}/merchant/dashboard`,
      cancel_url: cancelUrl || `${req.headers.get("origin") || "https://app.example.com"}/merchant/signup`,
      notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-itn`,
      email_address: user.email,
      m_payment_id: `${role.venue_id}_${planId}`,
      amount: amount.toFixed(2),
      item_name: `ReadyUp ${plan.name} Plan (${isAnnual ? "Annual" : "Monthly"})`,
      subscription_type: "1",
      billing_date: new Date().toISOString().split("T")[0],
      recurring_amount: amount.toFixed(2),
      frequency: frequency,
      cycles: "0", // indefinite
      custom_str1: role.venue_id,
      custom_str2: planId,
      custom_str3: billingCycle || "monthly",
    };

    // Generate signature
    const paramString = Object.entries(pfData)
      .filter(([_, v]) => v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
      .join("&");

    const signatureString = passphrase
      ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
      : paramString;

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(signatureString));
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    pfData.signature = signature;

    logStep("PayFast form data generated", { venue_id: role.venue_id, amount });

    return new Response(
      JSON.stringify({
        formData: pfData,
        paymentUrl: Deno.env.get("PAYFAST_SANDBOX") === "true"
          ? "https://sandbox.payfast.co.za/eng/process"
          : "https://www.payfast.co.za/eng/process",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
