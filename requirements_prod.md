# Production Requirements Checklist

Everything that must change when moving from localhost to production.

---

## 1. Resend (email sending)

| Item | Action |
|------|--------|
| Domain | Verify `akovolabs.co.za` in Resend (DKIM/SPF records at DNS host) ✅ done |
| `RESEND_FROM_EMAIL` | Keep as `Merchant Munchies <support@akovolabs.co.za>` — already production-ready |
| `RESEND_API_KEY` | Create a **production API key** in Resend → API Keys. Do NOT reuse the dev/test key. Add sending domain restriction if available |
| Rate limits | Free tier = 3,000 emails/month, 100/day. Upgrade plan if campus traffic exceeds this |

## 2. Google OAuth

In **Google Cloud Console → APIs & Services → Credentials** → your OAuth Client ID:

| Setting | Development value | Production value |
|---------|-------------------|------------------|
| Authorized JavaScript origins | `http://localhost:5173` | `https://your-frontend-domain.com` |
| Authorized redirect URIs | `https://npqvaoimvuwijbalsffp.supabase.co/auth/v1/callback` | Same (unchanged — it always points at Supabase) |

Add the production origin **alongside** localhost (don't replace it — keeps local dev working).

## 3. Supabase Dashboard

### Authentication → URL Configuration
| Setting | Value |
|---------|-------|
| Site URL | `https://your-frontend-domain.com` |
| Redirect URLs | Add `https://your-frontend-domain.com` (keep localhost too for dev) |

### Authentication → Hooks → Send Email
| Setting | Value |
|---------|-------|
| Hook URL | `https://api.your-domain.com/api/v1/email/supabase-hook` (replace ngrok URL) |
| Secret | Regenerate a fresh secret for production; store in server `.env` |

## 4. Server environment (`server/src/.env`)

```env
NODE_ENV=production
PORT=4000
BASE_URL=https://api.your-domain.com
CLIENT_ORIGIN=https://your-frontend-domain.com      # CORS - must match frontend exactly
CLIENT_URL=https://your-frontend-domain.com          # used in email links
SUPABASE_URL=https://npqvaoimvuwijbalsffp.supabase.co
SUPABASE_ANON_KEY=<same or new project>
SUPABASE_SERVICE_ROLE_KEY=<ROTATE - was exposed in git history>
SUPABASE_JWKS_URL=https://npqvaoimvuwijbalsffp.supabase.co/auth/v1/.well-known/jwks.json
RESEND_API_KEY=<NEW PRODUCTION KEY>
RESEND_FROM_EMAIL=Merchant Munchies <support@akovolabs.co.za>
SEND_EMAIL_HOOK_SECRET=<FRESH SECRET from Supabase hook>
```

## 5. Client environment (`client/src/.env`)

```env
VITE_API_BASE_URL=https://api.your-domain.com/api/v1   # no more vite proxy - full URL
VITE_SUPABASE_URL=https://npqvaoimvuwijbalsffp.supabase.co
VITE_SUPABASE_ANON_KEY=<same anon key>
VITE_APP_URL=https://your-frontend-domain.com
```

Note: the Vite `/api` proxy only exists in dev. In production the client calls the API host directly, so `VITE_API_BASE_URL` must be the absolute URL.

## 6. Hosting / infrastructure

| Component | Requirement |
|-----------|-------------|
| Express API | Public HTTPS URL (Render, Railway, Fly.io, VPS + nginx/caddy). No tunnels |
| Frontend | HTTPS static hosting (Vercel, Netlify, Cloudflare Pages) |
| CORS | Server allows only the production frontend origin |
| Helmet | Already enabled — verify it doesn't block cross-origin API calls |

## 7. Security rotation (IMPORTANT)

These secrets appeared in git history / chat during development. **Rotate all of them before launch:**

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — regenerate in Supabase → Settings → API
- [ ] `RESEND_API_KEY` — create new key, delete old one
- [ ] `SEND_EMAIL_HOOK_SECRET` — regenerate in Supabase hook settings
- [ ] Google OAuth Client Secret (if it was ever exposed)
- [ ] Confirm `.env`, `client/dist`, `node_modules` remain untracked in git (already fixed locally — do not revert)

## 8. Final smoke test after deploy

1. Sign up with email → branded confirmation arrives from support@akovolabs.co.za
2. Click link → lands back on production frontend, confirmed
3. Google sign-up → "Account created successfully" + welcome email
4. Existing account sign-in → "Signed in successfully"
5. Forgot password OTP email arrives branded
6. No email anywhere shows Supabase's default template
