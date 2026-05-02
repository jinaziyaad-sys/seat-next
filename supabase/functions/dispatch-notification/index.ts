// Fan-out wrapper: reads patron channel preferences and dispatches a notification
// to push, SMS, and/or WhatsApp in parallel. Called by DB trigger via notify_user_via_push.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DispatchBody {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  category?: string; // e.g. 'order_ready', 'table_ready', 'marketing'
  isMarketing?: boolean;
  whatsappContentSid?: string;
  whatsappContentVariables?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: DispatchBody = await req.json();
    const { userId, title, body, data = {}, category, isMarketing, whatsappContentSid, whatsappContentVariables } = payload;

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing userId/title/body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: prefs } = await supabase
      .from("patron_notification_preferences")
      .select("channel_push, channel_sms, channel_whatsapp, sms_opted_out_at, whatsapp_opted_out_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Default: push on, sms/wa off (matches DB column defaults)
    const wantPush = prefs?.channel_push ?? true;
    const wantSms = !!prefs?.channel_sms && !prefs?.sms_opted_out_at;
    const wantWa = !!prefs?.channel_whatsapp && !prefs?.whatsapp_opted_out_at;

    const authHeader = `Bearer ${serviceKey}`;
    const baseHeaders = {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "apikey": serviceKey,
    };

    const tasks: Promise<unknown>[] = [];

    if (wantPush) {
      tasks.push(fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST", headers: baseHeaders,
        body: JSON.stringify({ userId, title, body, data }),
      }).catch((e) => console.error("push dispatch failed:", e)));
    }

    if (wantSms) {
      const smsBody = `${title}\n${body}`;
      tasks.push(fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST", headers: baseHeaders,
        body: JSON.stringify({ userId, body: smsBody, category, title, appendStop: !!isMarketing }),
      }).catch((e) => console.error("sms dispatch failed:", e)));
    }

    if (wantWa) {
      tasks.push(fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST", headers: baseHeaders,
        body: JSON.stringify({
          userId,
          body: `${title}\n${body}`,
          category, title,
          contentSid: whatsappContentSid,
          contentVariables: whatsappContentVariables,
        }),
      }).catch((e) => console.error("wa dispatch failed:", e)));
    }

    await Promise.all(tasks);

    return new Response(JSON.stringify({ success: true, channels: { push: wantPush, sms: wantSms, whatsapp: wantWa } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("dispatch-notification error:", e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
