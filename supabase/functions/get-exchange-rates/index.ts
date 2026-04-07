import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_RATES: Record<string, number> = {
  USD: 0.055, EUR: 0.051, GBP: 0.044, AUD: 0.084, CAD: 0.075,
  CHF: 0.048, INR: 4.6, AED: 0.20, NGN: 85, KES: 7.1,
};

const CACHE_HOURS = 6;

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
    // Check cache first
    const cutoff = new Date(Date.now() - CACHE_HOURS * 3600000).toISOString();
    const { data: cached } = await supabase
      .from("exchange_rate_cache")
      .select("target_currency, rate, fetched_at")
      .eq("base_currency", "ZAR")
      .gte("fetched_at", cutoff);

    if (cached && cached.length > 0) {
      const rates: Record<string, number> = {};
      cached.forEach((r: any) => { rates[r.target_currency] = Number(r.rate); });
      return new Response(JSON.stringify({ base: "ZAR", rates, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch fresh rates from free API
    let rates: Record<string, number> = { ...FALLBACK_RATES };
    try {
      const resp = await fetch("https://open.er-api.com/v6/latest/ZAR");
      if (resp.ok) {
        const data = await resp.json();
        if (data.rates) {
          const targets = Object.keys(FALLBACK_RATES);
          targets.forEach(c => {
            if (data.rates[c]) rates[c] = data.rates[c];
          });
        }
      }
    } catch (e) {
      console.log("[EXCHANGE-RATES] API fetch failed, using fallback rates");
    }

    // Upsert into cache
    const upserts = Object.entries(rates).map(([currency, rate]) => ({
      base_currency: "ZAR",
      target_currency: currency,
      rate,
      fetched_at: new Date().toISOString(),
    }));

    for (const row of upserts) {
      await supabase
        .from("exchange_rate_cache")
        .upsert(row, { onConflict: "base_currency,target_currency" });
    }

    return new Response(JSON.stringify({ base: "ZAR", rates, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ base: "ZAR", rates: FALLBACK_RATES, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
