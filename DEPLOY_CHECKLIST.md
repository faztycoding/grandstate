# Grand$tate — Production Deployment Checklist

## Pre-Deploy (Done ✅)

- [x] Frontend lazy-loading — initial JS 510KB → 66KB gzip (−87%)
- [x] Vendor chunk splitting (react, ui, data)
- [x] Helmet security headers on backend
- [x] Global error handlers (uncaughtException, unhandledRejection)
- [x] ADMIN_EMAILS startup warning
- [x] Debug endpoint restricted to admin-only
- [x] Package limit consistency (frontend = backend = 10/300/750)
- [x] MarketplaceWorker tracker bug fixed (shared PostingTracker)
- [x] MarketplaceWorker delay now interruptible
- [x] Browser counter leak fixed
- [x] Admin endpoints secured with email whitelist
- [x] TypeScript: 0 errors
- [x] Vite production build: success

---

## VPS Backend Deploy (ssh root@76.13.185.83)

```bash
# 1. Pull latest code
cd /root/homepost-pro-main    # or your deploy path
git pull origin main

# 2. Install backend deps (includes new helmet package)
cd backend
npm install --omit=dev

# 3. Verify backend .env has ALL required vars:
cat .env
#   PORT=3001
#   FRONTEND_URL=https://www.grandstate.io,https://grandstate.io
#   SUPABASE_URL=https://fotoqgmdyiribobdhslu.supabase.co
#   SUPABASE_SERVICE_KEY=<service-role-key>
#   ADMIN_EMAILS=<your-admin-email@gmail.com>
#   HEADLESS=true
#   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
#   ANTHROPIC_API_KEY=<optional>

# 4. Restart backend
pm2 restart homepost-backend   # or: systemctl restart homepost

# 5. Verify
curl https://api.grandstate.io/api/ping
# Should return: {"success":true, ...}
```

## Frontend Deploy (Vercel)

```bash
# Vercel auto-deploys on git push. Verify env vars in Vercel dashboard:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   VITE_API_BASE=https://api.grandstate.io
#   VITE_ADMIN_EMAILS=<admin-email>
#   VITE_OMISE_PUBLIC_KEY=<production-key>    ← swap from pkey_test_*

# After deploy, check:
# https://www.grandstate.io → Landing page loads
# https://www.grandstate.io/auth → Auth page loads
```

## Supabase Production Check

- [ ] RLS policies enabled on `properties`, `facebook_groups`, `license_keys`
- [ ] `user_id` filter on SELECT/INSERT/UPDATE/DELETE for user tables
- [ ] `license_keys` — only admins can UPDATE, users can SELECT own
- [ ] Email confirmation enabled in Auth settings
- [ ] Rate limiting on Auth (Supabase dashboard → Auth → Rate Limits)

## Post-Deploy Verification

- [ ] `curl https://api.grandstate.io/api/ping` returns success
- [ ] Sign up → confirm email → login works
- [ ] License key activation works
- [ ] Create property → appears in DB
- [ ] Add group → appears in DB
- [ ] Start automation → browser opens on VPS (headless)
- [ ] Admin dashboard at `/adminfaz` — only admin emails can see data
- [ ] Omise payment flow works with **production** key

## Security Reminders

- **Swap Omise test key** (`pkey_test_*`) → production key before going live
- **ADMIN_EMAILS** must be set in both frontend `.env` and backend `.env`
- **SUPABASE_SERVICE_KEY** must NEVER be in frontend code
- Backend runs behind Nginx with `trust proxy = 1`
- CORS locked to `grandstate.io` + `www.grandstate.io`
