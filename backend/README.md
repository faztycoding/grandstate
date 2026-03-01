# Grand$tate Backend

Main API server — Automation engine, queue system, session management.

**Port**: `3001` · **Production**: `api.grandstate.io`

## Setup

```bash
cd backend
npm install
cp .env.example .env   # Fill in Supabase + admin config
npm run dev
```

## Environment Variables (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service role key |
| `ADMIN_EMAILS` | ✅ | Admin emails (comma-separated) |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS |
| `PORT` | | Server port (default: 3001) |

## API Endpoints

### Auth & Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ping` | Health check |
| POST | `/api/auth/verify-token` | Verify JWT token |

### Automation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/start` | Start automation job |
| POST | `/api/automation/stop` | Stop automation |
| GET | `/api/automation/status` | Current status |
| GET | `/api/automation/stream` | SSE real-time progress |

### Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posting-history` | Posting history |
| GET | `/api/user/real-stats` | User usage statistics |
| GET | `/api/analytics` | Analytics overview |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/change-package` | Change user package |
| GET | `/api/admin/engine-status` | Engine worker status |
| POST | `/api/admin/clear-history` | Clear job history |

### Session / Presence
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session/presence` | Heartbeat (user online) |
| GET | `/api/session/active-users` | Active users count |

## Services

```
backend/src/services/
├── postingTracker.js       # Daily limit + duplicate prevention + history
├── userSessionManager.js   # Active user presence tracking
└── marketplaceWorker.js    # Facebook Marketplace automation
```

### PostingTracker
- Daily cycle reset at **05:00 AM**
- Package limits: Free 10/day, Agent 300/day, Elite 750/day
- Duplicate prevention per property+group combination
- History persisted to `data/{userId}/posting-history.json`

## Production (VPS)

```bash
# Start with PM2
pm2 start src/index.js --name backend

# Nginx config points api.grandstate.io → localhost:3001
```
