

## Plan: Set Up Branded Auth Email Templates for ReadyUp

### What this does
Creates custom-branded password reset, signup verification, and magic link emails that will be sent from `notify.readyup.site` matching your app's orange/warm design.

### Steps

1. **Scaffold auth email templates** — Creates 6 email templates (signup, recovery, magic link, invite, email change, reauthentication) and the `auth-email-hook` edge function

2. **Apply ReadyUp brand styling to all templates**
   - Primary button: `hsl(18, 85%, 62%)` (your pastel orange)
   - Text color: `hsl(20, 25%, 25%)` (dark brown)
   - Muted text: `hsl(20, 10%, 45%)`
   - Border radius from your design system
   - White email background (email standard)
   - Match casual, warm tone consistent with ReadyUp's style

3. **Deploy the auth-email-hook edge function**

4. **Confirm setup** — Emails will start sending automatically once DNS verification completes. You can monitor progress in Cloud → Emails.

### Technical Details
- Templates are React Email components in `supabase/functions/_shared/email-templates/`
- The `auth-email-hook` edge function intercepts Supabase auth events and renders branded emails
- DNS verification is NOT required for scaffolding/deploying — only for actually sending

