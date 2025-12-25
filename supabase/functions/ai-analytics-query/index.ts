import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyticsQueryRequest {
  question: string;
}

type QueryType =
  | "top_venue_orders_this_week"
  | "top_venue_orders_last_7_days"
  | "avg_wait_time_all_time";

type PlannedQuery = {
  type: QueryType;
  params?: {
    limit?: number;
  };
};

function coerceLimit(input: unknown, fallback = 1) {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(25, Math.trunc(n)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase configuration missing");

    const { question }: AnalyticsQueryRequest = await req.json();
    const trimmed = (question || "").trim();

    if (!trimmed) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trimmed.length > 500) {
      return new Response(JSON.stringify({ error: "Question too long (max 500 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing analytics question:", trimmed);

    // IMPORTANT: use the caller's JWT so RLS applies
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const tools = [
      {
        type: "function",
        function: {
          name: "plan_analytics_query",
          description:
            "Choose which safe analytics query to run and optional parameters like result limit.",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "top_venue_orders_this_week",
                  "top_venue_orders_last_7_days",
                  "avg_wait_time_all_time",
                ],
              },
              params: {
                type: "object",
                properties: {
                  limit: { type: "number" },
                },
                additionalProperties: false,
              },
            },
            required: ["type"],
            additionalProperties: false,
          },
        },
      },
    ];

    const systemPrompt = `You are an analytics assistant for a restaurant platform.

You MUST select exactly one of the provided safe analytics queries using the tool call.
Do not generate SQL.

Mapping hints:
- "most orders" + "this week" => top_venue_orders_this_week
- "most orders" + "last 7 days" / "past week" => top_venue_orders_last_7_days
- "average wait time" => avg_wait_time_all_time

Default limit: 1.`;

    const planResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: trimmed },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "plan_analytics_query" } },
      }),
    });

    if (!planResp.ok) {
      if (planResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (planResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await planResp.text();
      console.error("AI gateway error:", planResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planData = await planResp.json();
    const toolCall = planData.choices?.[0]?.message?.tool_calls?.[0];

    let planned: PlannedQuery | null = null;

    try {
      const argsRaw = toolCall?.function?.arguments;
      const args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
      planned = args as PlannedQuery;
    } catch (e) {
      console.error("Failed to parse tool arguments:", e);
      planned = null;
    }

    // Fallback (should be rare)
    if (!planned?.type) {
      const q = trimmed.toLowerCase();
      planned = {
        type: q.includes("average") && q.includes("wait") ? "avg_wait_time_all_time" : "top_venue_orders_this_week",
        params: { limit: 1 },
      };
    }

    const limit = coerceLimit(planned.params?.limit, 1);

    console.log("Planned analytics query:", planned.type, "limit:", limit);

    let explanation = "";
    let results: any[] = [];

    if (planned.type === "top_venue_orders_this_week") {
      explanation =
        "This finds the venue(s) with the highest number of orders created since the start of the current week.";
      const { data, error } = await supabase.rpc("analytics_top_venue_orders_this_week", { p_limit: limit });
      if (error) throw error;
      results = (data as any[]) ?? [];
    } else if (planned.type === "top_venue_orders_last_7_days") {
      explanation = "This finds the venue(s) with the highest number of orders created in the last 7 days.";
      const { data, error } = await supabase.rpc("analytics_top_venue_orders_last_7_days", { p_limit: limit });
      if (error) throw error;
      results = (data as any[]) ?? [];
    } else if (planned.type === "avg_wait_time_all_time") {
      explanation = "This calculates the average actual wait time (minutes) across all venues (all time).";
      const { data, error } = await supabase.rpc("analytics_avg_wait_time_all_time");
      if (error) throw error;
      results = (data as any[]) ?? [];
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        question: trimmed,
        sql: null,
        explanation,
        query: { type: planned.type, params: { limit } },
        results,
        error: null,
        tokens_used: planData.usage?.total_tokens || 0,
        duration_ms: durationMs,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("Error in ai-analytics-query:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
