

# Google Sign-In with Phone Number Prompt

## Overview

Add Google OAuth as a sign-in option for patrons. When a user signs in with Google for the first time, they will be prompted to add their phone number to complete their profile (required for waitlist SMS notifications).

## How It Works

```text
User Flow:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Auth Page      │     │  Google OAuth   │     │  App Checks     │
│  "Sign in with  │ ──► │  Popup/Redirect │ ──► │  Profile        │
│   Google"       │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                    ┌───────────────────┴───────────────────┐
                                    ▼                                       ▼
                        ┌─────────────────────┐               ┌─────────────────────┐
                        │  Has Phone Number   │               │  No Phone Number    │
                        │  ──────────────────►│               │  ─────────────────► │
                        │  Continue to Home   │               │  Show Phone Prompt  │
                        └─────────────────────┘               └─────────────────────┘
                                                                        │
                                                                        ▼
                                                        ┌─────────────────────────────┐
                                                        │  User Enters Phone          │
                                                        │  ─────────────────────────► │
                                                        │  Optional: Verify via SMS   │
                                                        │  Continue to Home           │
                                                        └─────────────────────────────┘
```

## Technical Implementation

### 1. Supabase Dashboard Configuration (User Action Required)

The user needs to configure Google OAuth in their Supabase project dashboard:

1. Go to **Google Cloud Console** and create OAuth credentials
2. Add `cuoqjgahpfymxqrdlzlf.supabase.co` as an authorized domain
3. Add `https://cuoqjgahpfymxqrdlzlf.supabase.co/auth/v1/callback` as the redirect URL
4. In **Supabase Dashboard > Authentication > Providers**, enable Google and paste the Client ID + Secret

### 2. Update Database Trigger

Modify `handle_new_user` to handle Google OAuth users who may not have a full_name initially:

| Current | New |
|---------|-----|
| `COALESCE(NEW.raw_user_meta_data->>'full_name', '')` | Also try `NEW.raw_user_meta_data->>'name'` (Google's field) |

```sql
-- Updated trigger handles both custom signup and Google OAuth
full_name = COALESCE(
  NEW.raw_user_meta_data->>'full_name',
  NEW.raw_user_meta_data->>'name',        -- Google uses 'name'
  NEW.raw_user_meta_data->>'given_name',  -- Fallback
  ''
)
```

### 3. Create Phone Prompt Component

New file: `src/components/PhonePromptDialog.tsx`

A dialog that appears after Google sign-in when no phone is on file:
- Phone input field with country code validation
- "Skip for now" option (phone is not mandatory)
- Optional SMS verification (same as signup flow)
- Updates profile with phone number

### 4. Update Auth.tsx

Add Google Sign-In button to both Sign In and Sign Up tabs:

```text
┌──────────────────────────────────────┐
│            Sign In                   │
├──────────────────────────────────────┤
│  Email: ____________________         │
│  Password: _________________         │
│                                      │
│  [       Sign In       ]             │
│                                      │
│  ─────── or continue with ───────   │
│                                      │
│  [  🔵 Sign in with Google  ]        │
└──────────────────────────────────────┘
```

Implementation:
```typescript
const handleGoogleSignIn = async () => {
  setLoading(true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth?checkPhone=true`,
    },
  });
  if (error) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
    setLoading(false);
  }
};
```

### 5. Update Index.tsx (Home Page)

Add check for incomplete profile on load:

```typescript
// After auth state confirms user is logged in
useEffect(() => {
  if (user) {
    // Check if profile has phone number
    supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.phone) {
          // Show phone prompt dialog
          setShowPhonePrompt(true);
        }
      });
  }
}, [user]);
```

### 6. Update Auth Redirect Handling

Modify `Auth.tsx` to check for `checkPhone` URL parameter after OAuth redirect:

```typescript
// In useEffect
const params = new URLSearchParams(window.location.search);
if (params.get('checkPhone') && session) {
  // Redirect to home where phone check happens
  navigate('/', { replace: true });
}
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| **New Migration** | Update `handle_new_user` trigger to support Google's name fields |
| **New Component** `src/components/PhonePromptDialog.tsx` | Dialog to collect phone number after Google sign-in |
| `src/pages/Auth.tsx` | Add Google sign-in button to both tabs |
| `src/pages/Index.tsx` | Add check for missing phone and show prompt dialog |

---

## Compatibility Notes

| Concern | Status |
|---------|--------|
| Existing email/password users | No change - works as before |
| User roles system | No impact - roles table separate from profiles |
| Phone verification (SMS OTP) | Compatible - can use existing flow in prompt |
| Merchant auth pages | Unaffected - only patron auth gets Google option |
| Database trigger | Will handle both signup methods correctly |

---

## User Setup Instructions

After implementation, you'll need to configure Google OAuth in your Supabase dashboard:

1. **Create Google Cloud OAuth Credentials**
   - Go to console.cloud.google.com
   - Create a new project or select existing
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID (Web application)
   
2. **Configure Authorized URLs**
   - Authorized JavaScript origins: `https://cuoqjgahpfymxqrdlzlf.supabase.co`
   - Authorized redirect URIs: `https://cuoqjgahpfymxqrdlzlf.supabase.co/auth/v1/callback`
   
3. **Enable in Supabase Dashboard**
   - Go to Authentication > Providers
   - Enable Google
   - Paste Client ID and Client Secret

