// Twilio inbound webhook: handles delivery status updates and STOP/START opt-outs.
// Configure in Twilio console: Messaging → Phone Number → A MESSAGE COMES IN + STATUS CALLBACK
//   → POST https://<project>.supabase.co/functions/v1/twilio-webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_KEYWORDS = ["START", "YES", "UNSTOP"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const form = await req.formData();
    const messageSid = form.get("MessageSid")?.toString();
    const messageStatus = form.get("MessageStatus")?.toString(); // delivery status callback
    const fromRaw = form.get("From")?.toString() ?? "";
    const body = (form.get("Body")?.toString() ?? "").trim().toUpperCase();

    // 1. Delivery status callback — update notification_log
    if (messageSid && messageStatus) {
      await supabase.from("notification_log")
        .update({ status: messageStatus })
        .eq("provider_sid", messageSid);
    }

    // 2. Inbound message — STOP/START handling
    if (fromRaw && body) {
      const isWhatsApp = fromRaw.startsWith("whatsapp:");
      const phone = fromRaw.replace(/^whatsapp:/, "");

      const { data: profile } = await supabase
        .from("profiles").select("id").eq("phone", phone).maybeSingle();

      if (profile?.id) {
        if (STOP_KEYWORDS.includes(body)) {
          const patch = isWhatsApp
            ? { whatsapp_opted_out_at: new Date().toISOString(), channel_whatsapp: false }
            : { sms_opted_out_at: new Date().toISOString(), channel_sms: false };
          await supabase.from("patron_notification_preferences")
            .upsert({ user_id: profile.id, ...patch }, { onConflict: "user_id" });
        } else if (START_KEYWORDS.includes(body)) {
          const patch = isWhatsApp
            ? { whatsapp_opted_out_at: null, channel_whatsapp: true }
            : { sms_opted_out_at: null, channel_sms: true };
          await supabase.from("patron_notification_preferences")
            .upsert({ user_id: profile.id, ...patch }, { onConflict: "user_id" });
        }
      }
    }

    // Twilio expects 200 + empty TwiML so it doesn't auto-reply
    return new Response("<Response/>", {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (e) {
    console.error("twilio-webhook error:", e);
    return new Response("<Response/>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
