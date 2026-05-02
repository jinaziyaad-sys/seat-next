// Send a WhatsApp message via Twilio. For marketing, must use a pre-approved Twilio template (contentSid).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";

interface WaBody {
  userId: string;
  body: string;
  category?: string;
  title?: string;
  contentSid?: string; // approved template SID for marketing/outside 24h window
  contentVariables?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { userId, body, category, title, contentSid, contentVariables }: WaBody = await req.json();
    if (!userId || (!body && !contentSid)) {
      return new Response(JSON.stringify({ error: "Missing userId and body/contentSid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: profile } = await supabase
      .from("profiles").select("phone, phone_verified")
      .eq("id", userId).maybeSingle();

    if (!profile?.phone || !profile.phone_verified) {
      return new Response(JSON.stringify({ skipped: "phone-not-verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: prefs } = await supabase
      .from("patron_notification_preferences")
      .select("channel_whatsapp, whatsapp_opted_out_at")
      .eq("user_id", userId).maybeSingle();

    if (!prefs?.channel_whatsapp || prefs.whatsapp_opted_out_at) {
      return new Response(JSON.stringify({ skipped: "whatsapp-not-opted-in" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const params = new URLSearchParams({
      To: `whatsapp:${profile.phone}`,
      From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
    });
    if (contentSid) {
      params.set("ContentSid", contentSid);
      if (contentVariables) params.set("ContentVariables", JSON.stringify(contentVariables));
    } else {
      params.set("Body", body);
    }

    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const twilioResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
    );

    const twilioData = await twilioResp.json();

    await supabase.from("notification_log").insert({
      user_id: userId,
      channel: "whatsapp",
      category: category ?? null,
      title: title ?? null,
      body: body ?? `[template:${contentSid}]`,
      provider_sid: twilioData.sid ?? null,
      status: twilioResp.ok ? (twilioData.status ?? "queued") : "failed",
      error: twilioResp.ok ? null : (twilioData.message ?? `HTTP ${twilioResp.status}`),
    });

    if (!twilioResp.ok) {
      return new Response(JSON.stringify({ error: twilioData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, sid: twilioData.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-whatsapp error:", e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
