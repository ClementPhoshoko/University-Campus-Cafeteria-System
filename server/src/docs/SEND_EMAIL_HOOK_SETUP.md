# Supabase Send Email Hook — Local Development Setup

## What is this?

Supabase's **Send Email Hook** intercepts auth emails (signup, reset, magic link) and sends them to your own endpoint instead of using Supabase's built-in email delivery. Your server then sends the email via Resend with branded templates.

## Why do we need a public URL?

Supabase's hook is an HTTP webhook — it sends a POST request to your server. For Supabase to reach your local development server, it needs a public URL. **ngrok** creates a temporary public URL that tunnels to your local machine.

---

## Option A: ngrok (recommended)

### 1. Download and install ngrok (one-time)

1. Go to https://ngrok.com and sign up for a **free account**
2. Download the Windows version: https://ngrok.com/download
3. Unzip `ngrok.exe` to a folder, e.g. `C:\Tools\ngrok`
4. Add that folder to your PATH, or just run it from that folder

### 2. Connect your ngrok account (one-time)

Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken, then:

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### 3. Start your Express server

```bash
cd server
npm run dev
```

Server runs on `http://localhost:4000`.

### 4. Start the ngrok tunnel (new terminal)

**Important:** the port in the ngrok command must match your server's port. This project runs Express on **4000** (see `PORT` in `server/src/.env`), so use 4000 — not the default 80 you may see in other tutorials:

```bash
ngrok http 4000
```

Rule of thumb:

| Your server runs on | ngrok command |
|---------------------|---------------|
| 4000 (this project) | `ngrok http 4000` |
| 3000 | `ngrok http 3000` |
| 8080 | `ngrok http 8080` |

If the ports don't match, ngrok starts fine but every request fails with `ERR_NGROK_8012` ("failed to establish a connection to the upstream web service").

Output shows something like:

```
Forwarding  https://a1b2-102-65-xxx-xxx.ngrok-free.app -> http://localhost:4000
```

Copy the `https://...` URL on the left.

### 5. Configure Supabase Dashboard

Go to:
```
Authentication → Hooks → Send Email → Create hook
```

- **Type:** HTTPS
- **URL:** `https://a1b2-102-65-xxx-xxx.ngrok-free.app/api/v1/email/supabase-hook`
- Copy the generated secret (`v1,whsec_...`)

### 6. Add secret to `.env`

```env
SEND_EMAIL_HOOK_SECRET=v1,whsec_...
```

Restart your Express server after changing `.env`.

### 7. Test

Sign up a new user. The flow should be:

```
React signup → Supabase creates account → Hook fires →
Your Express server → Resend sends branded email
```

Check the ngrok terminal window — you should see the incoming POST request to `/api/v1/email/supabase-hook`.

---

## Option B: localtunnel (no account needed)

```bash
npm install -g localtunnel
lt --port 4000
```

Use the printed URL the same way as ngrok above.

**Downside:** shows a warning page on first visit ("Click to Continue") which can block Supabase's webhook request.

---

## Important Notes

- **The tunnel URL changes every time** you restart ngrok/localtunnel — update the Supabase Dashboard URL each time
- Free ngrok URLs are random; paid accounts get stable domains
- **This is for development only** — use your real domain in production
- ngrok free tier has connection limits, fine for testing

## Production Setup

In production you don't need any tunnel. Deploy your Express server (Render, Railway, VPS, etc.) and set the hook URL to:

```
https://api.yourdomain.com/api/v1/email/supabase-hook
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Hook not firing | Check URL is correct and both server + tunnel are running |
| 401 Invalid signature | `SEND_EMAIL_HOOK_SECRET` in `.env` doesn't match Supabase dashboard |
| 500 Failed to send email | Check `RESEND_API_KEY` in `.env` |
| Email not received | Check Resend dashboard for delivery status |
| Tunnel URL expired | Restart ngrok and update Supabase dashboard URL |
| ngrok browser warning | Free tier shows an interstitial — Supabase webhooks may be blocked; use localtunnel workaround or add header bypass |

## Architecture Reference

```
React Signup.jsx
      │ supabase.auth.signUp()
      ▼
Supabase Auth (creates user, confirm email ON)
      │ Send Email Hook fires
      ▼ POST signed webhook
Express  POST /api/v1/email/supabase-hook
      │ verify signature → build verify URL → render branded template
      ▼
Resend API
      ▼
User's inbox (branded email)
      │ user clicks link
      ▼
Supabase /auth/v1/verify (confirms email)
      │ redirect_to
      ▼
React app
```
