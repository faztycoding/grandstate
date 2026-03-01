# Grand$tate v1.1.0

**Real Estate Posting Automation Platform**

ระบบโพสต์ประกาศอสังหาริมทรัพย์ลง Facebook Groups อัตโนมัติ สำหรับนายหน้ามืออาชีพ

🌐 **Production**: [grandstate.io](https://grandstate.io) · 🔧 **API**: [api.grandstate.io](https://api.grandstate.io)

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/faztycoding/grandstate.git
cd grandstate
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your Supabase + Omise keys

# 3. Start frontend dev server
npm run dev

# 4. Start backend (separate terminal)
cd backend
npm install
npm run dev
```

## Project Structure

```
├── src/                  # Frontend (React + TypeScript)
│   ├── pages/            #   Page components
│   ├── components/       #   UI components
│   ├── hooks/            #   Custom React hooks
│   ├── i18n/             #   Internationalization (TH/EN)
│   └── lib/              #   Utilities, Supabase client
├── backend/              # Main API server (Express + Puppeteer)
│   └── src/
│       ├── index.js      #   API routes (40+ endpoints)
│       └── services/     #   PostingTracker, SessionManager
├── server/               # Payment server (Omise)
│   └── payment.js        #   Charge + Webhook (port 3002)
├── supabase/             # Database SQL setup files
├── public/               # Static assets + Service Worker
└── GRANDSTATE_OVERVIEW.md  # Full technical documentation
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, Framer Motion |
| **Backend** | Node.js, Express, Puppeteer, PM2 |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **Payment** | Omise (PromptPay, Credit Card) |
| **Hosting** | Vercel (frontend CDN), VPS (backend) |

## Scripts

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint check
npm run test       # Run Vitest tests
```

## Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_BASE` | Backend API URL |
| `VITE_ADMIN_EMAILS` | Admin email(s), comma-separated |
| `VITE_OMISE_PUBLIC_KEY` | Omise public key (frontend) |

See `backend/.env` and `server/.env.example` for backend-specific vars.

## Database Setup

Run `supabase/FULL_SETUP.sql` in Supabase SQL Editor — it's idempotent (safe to re-run).

## Deployment

- **Frontend** → Auto-deploys to Vercel on `git push origin main`
- **Backend** → SSH to VPS, `git pull && pm2 restart backend`
- **Payment** → SSH to VPS, `pm2 restart payment`

## Documentation

See [`GRANDSTATE_OVERVIEW.md`](./GRANDSTATE_OVERVIEW.md) for full technical documentation including architecture diagrams, API reference, and glossary.
