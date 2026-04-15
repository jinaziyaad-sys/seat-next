

## What You Need

A public-facing **marketing website** (like uber.com) — with About Us, How It Works, Contact, Social Media links, download badges — that is completely separate from the **in-app experience** patrons/merchants use after logging in.

## How to Keep Them Separate for Mobile Apps

The key insight: your React app currently serves everything from one codebase. When you package for Android/iOS (via Capacitor), the mobile app should launch directly into the **app experience** (the current `Index.tsx` patron flow), never showing the marketing website. Here's how:

```text
Web visitors (browser):
  yourdomain.com  →  Marketing Landing Page (new)
  yourdomain.com/app  →  Patron App (current Index.tsx)
  yourdomain.com/merchant/...  →  Merchant flows

Mobile app (Capacitor):
  App opens  →  /app  (skips landing page entirely)
```

**Two approaches exist:**

1. **Same codebase, different routes** (recommended for now) — Add a `/landing` or make `/` the marketing page, move the patron app to `/app`. Configure Capacitor's start URL to `/app`. Simple, one deploy.

2. **Separate codebase/subdomain** — Host marketing site on `yourdomain.com` and app on `app.yourdomain.com`. More complex, better long-term separation.

We'll go with **approach 1** since it keeps everything in one project.

## Plan

### 1. Create the Landing/Marketing Page

**New file: `src/pages/Landing.tsx`**

A polished, scrollable marketing page with these sections:
- **Hero** — App name, tagline ("Skip the wait. Know when you're ready."), CTA buttons (Sign Up / Log In), app store badges (placeholder links)
- **How It Works** — 3-step visual explainer (Join waitlist → Get notified → Enjoy)
- **About Us** — Mission statement, team/company blurb
- **Features** — Key patron and merchant features in a grid
- **Contact Us** — Email, social media links (Instagram, Twitter/X, Facebook, TikTok)
- **Footer** — Privacy policy link, social icons, copyright

Style: Full-width sections, modern design consistent with the app's pastel/glass aesthetic.

### 2. Move Patron App to `/app` Route

**Edit: `src/App.tsx`**
- `/` → `<Landing />` (new marketing page)
- `/app` → `<Index />` (current patron experience)
- All other routes stay the same

### 3. Update Navigation

**Edit: `src/components/Header.tsx`**
- On the landing page, show a marketing header with Login/Sign Up buttons
- The existing app header continues working for `/app`, `/merchant/*`, `/dev/*`

**Edit: `src/pages/Auth.tsx`** (and any post-login redirects)
- After login, redirect patrons to `/app` instead of `/`

### 4. Mobile App Readiness

When you later set up Capacitor for native packaging:
- Set `server.url` to point to `/app` (or configure `capacitor.config.ts` with `"server": { "url": "https://yourdomain.com/app" }`)
- Mobile users never see the landing page — they go straight into the app
- The landing page lives only on the web for new visitor acquisition

### Files Changed
| File | Change |
|------|--------|
| `src/pages/Landing.tsx` | New marketing landing page |
| `src/App.tsx` | Route `/` → Landing, `/app` → Index |
| `src/components/Header.tsx` | Marketing header for landing page |
| `src/pages/Auth.tsx` | Post-login redirect to `/app` |
| `src/components/TabNavigation.tsx` | Update any home navigation to `/app` |

