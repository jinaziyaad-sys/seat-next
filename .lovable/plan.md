## Goal

Send the same critical notifications you already push (table ready, order ready, ETA changes, merchant marketing) over **SMS and WhatsApp**, in addition to web push. Use Twilio for both — it's the most practical path because:

- Twilio credentials are already configured (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
- One vendor, one bill, one API surface for SMS + WhatsApp
- Phone numbers are already collected on `profiles.phone` and verified via `phone_verified`
- WhatsApp Business uses the same Twilio account (just a different `From:` prefix `whatsapp:+...`)

## What changes for the patron

1. In **Profile → Notifications**, three channel toggles: **Push**, **SMS**, **WhatsApp** (default: Push on, SMS/WhatsApp off — POPIA-safe opt-in).
2. Per-category toggles stay (table ready, order ready, marketing, etc.). A category fires on every channel the patron has enabled.
3. SMS/WhatsApp toggles are disabled until `phone_verified = true` (re-uses existing OTP flow).
4. Quiet hours and `max_nudges_per_day` apply across all channels (cost control).
5. Marketing/re-engagement messages include a "Reply STOP to unsubscribe" footer (Twilio handles STOP automatically and we honour it via webhook).

## What changes for the merchant

No UI change required for transactional notifications — they ride existing DB triggers. For the marketing campaign feature you mentioned earlier, the campaign builder gets a **channel selector** (Push / SMS / WhatsApp) so merchants can pick — with cost shown per channel.

## Architecture

```text
DB trigger (order/waitlist status change)
        │
        ▼
notify_user_via_push (existing)         ← keep, unchanged
        │
        ▼
NEW: notify_user (fan-out)
        │
        ├── push  → send-push-notification (existing)
        ├── sms   → send-sms        (NEW, Twilio REST)
        └── wa    → send-whatsapp   (NEW, Twilio REST)
```

A single new edge function `dispatch-notification` reads the patron's channel prefs, formats the message per channel, and calls Twilio. Existing triggers call `dispatch-notification` instead of `send-push-notification` directly.

## Database changes

Add to `patron_notification_preferences`:
- `channel_push boolean default true`
- `channel_sms boolean default false`
- `channel_whatsapp boolean default false`
- `sms_opted_out_at timestamptz` (set when STOP received)
- `whatsapp_opted_out_at timestamptz`

New table `notification_log` (id, user_id, channel, category, twilio_sid, status, cost_estimate, sent_at) — for cost tracking, debugging, and STOP handling.

## New edge functions

1. **`send-sms`** — POST `{ userId, body }` → looks up phone, checks opt-in, calls Twilio `/Messages.json` with `From: TWILIO_PHONE_NUMBER`, logs.
2. **`send-whatsapp`** — same but `From: whatsapp:${TWILIO_PHONE_NUMBER}` and `To: whatsapp:+...`. Uses **pre-approved templates** for marketing (Twilio requirement); transactional uses freeform within 24h session window.
3. **`dispatch-notification`** — fan-out wrapper that reads prefs and calls the right channels in parallel. Replaces direct calls to `send-push-notification` from `notify_user_via_push`.
4. **`twilio-webhook`** — receives delivery status + STOP/START keywords from Twilio, updates `notification_log` and flips opt-out flags.

## Existing code touched

- `notify_user_via_push` Postgres function → renamed/wrapped to call `dispatch-notification` instead.
- `PatronNotificationSettings.tsx` → add 3 channel toggles + phone verification gate.
- `send-engagement-nudge` cron → uses dispatch fan-out (so nudges also go via SMS/WA if enabled).

## Costs & operational notes (important — please read)

- **SMS**: ~$0.04–0.08 per message in ZA via Twilio. Add the `max_nudges_per_day` cap and disable SMS for marketing on the Starter tier.
- **WhatsApp**: ~$0.005 per **transactional** message in the 24-hour customer service window (much cheaper than SMS). **Marketing templates** must be pre-approved by Meta and cost ~$0.04. Plan to register 2–3 templates (table ready, order ready, marketing).
- **WhatsApp Business setup is required**: you must (a) enable WhatsApp on the Twilio number in Twilio console, (b) submit a Facebook Business verification, (c) get message templates approved. This takes 1–5 business days and **must be done by you in the Twilio/Meta UI** — not something I can do from code.
- **SMS Pumping Protection**: I'll enable Geo Permissions for ZA only and recommend you turn on SMS Pumping Protection in Twilio console.

## Build order

1. DB migration: add channel columns + `notification_log` table.
2. Build `send-sms` + `send-whatsapp` edge functions (SMS works immediately; WhatsApp needs your Twilio template approval before it'll send).
3. Build `dispatch-notification` fan-out + repoint `notify_user_via_push` to it.
4. Update `PatronNotificationSettings` UI with channel toggles + phone-verified gating.
5. Build `twilio-webhook` for STOP handling + delivery receipts.
6. Add channel selector to merchant marketing campaign builder.

## What I need from you before/after build

- **Now**: confirm Twilio number is SMS-capable for ZA (and confirm budget — SMS isn't free).
- **After step 2**: in Twilio console, enable WhatsApp on your sender and submit the 3 templates I'll give you the exact copy for.
- **Optional**: if you'd rather use a cheaper SMS provider for ZA (e.g. Clickatell, BulkSMS), say so now — Twilio is the easiest because it's already wired, but ZA-local providers can be ~50% cheaper.
