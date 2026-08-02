# Google OAuth Setup

Covers everything needed to activate the "Continue with Google" buttons on `/login` and `/register`. The code is already in place — this is purely external configuration.

---

## How it works

Browser calls `supabase.auth.signInWithOAuth` → Supabase redirects to Google → Google redirects back to `/auth/callback?code=...` → app exchanges the code for a session (PKCE flow).

---

## Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. **Application type:** choose **Web application** (not Desktop app — that uses a different redirect flow incompatible with browser-based apps)
6. Give it a name (e.g. "Sunday Huddle Web")
7. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000` (local dev)
   - `https://yourdomain.com` (production)
8. Under **Authorized redirect URIs**, add:
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
   Your project ref is the subdomain in `NEXT_PUBLIC_SUPABASE_URL`.
9. Click **Create**
10. Copy the **Client ID** and **Client Secret** — you'll need both for Step 2

> Note: Google says changes can take 5 minutes to a few hours to propagate.

---

## Step 2 — Supabase Dashboard

### 2a — Enable Google provider

1. Go to your Supabase project → **Authentication → Providers**
2. Find **Google** and toggle it on
3. Paste the **Client ID** and **Client Secret** from Step 1
4. Save

### 2b — Configure allowed URLs (required — this is what causes `bad_oauth_state` if skipped)

Go to **Authentication → URL Configuration** and set:

- **Site URL**: your primary domain (e.g. `https://yourdomain.com`, or `http://localhost:3000` for local-only)
- **Redirect URLs**: add one entry per environment you run the app from:
  ```
  http://localhost:3000/**
  https://yourdomain.com/**
  ```

The `**` wildcard covers `/auth/callback` and any future paths. You can have multiple entries — Supabase checks that the `redirectTo` URL from the app matches any one of them.

The app uses `window.location.origin` dynamically, so the same code works in every environment automatically. You just need each domain listed here.

---

## Step 3 — Verify

1. Run the app locally (`npm run dev`)
2. Go to `/login` and click "Continue with Google"
3. You should be redirected to Google's consent screen
4. After approving, you should land back on the dashboard

If it fails with `bad_oauth_state`, the Redirect URL for your current domain is missing from step 2b.

If it fails with `redirect_uri_mismatch`, the Supabase callback URL in Google Cloud Console doesn't exactly match (no trailing slash, must be the `supabase.co` URL not your app URL).

Other things to check:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`
- The Google provider is toggled on and saved in Supabase
