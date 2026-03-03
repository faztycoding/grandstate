import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { authMiddleware } from './middleware/auth.js';
import { sessionManager } from './services/userSessionManager.js';
import { automationQueue } from './services/automationQueue.js';
import createUserRoutes from './routes/user.js';
import createPostingRoutes from './routes/posting.js';
import createGroupRoutes from './routes/groups.js';
import createAutomationRoutes from './routes/automation.js';
import createFacebookRoutes from './routes/facebook.js';
import createAdminRoutes from './routes/admin.js';
import createAnalyticsRoutes from './routes/analytics.js';
import createScheduleRoutes from './routes/schedules.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Admin email whitelist (comma-separated in env)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Generate unique display ID in format GS###XX (e.g. GS042ZK)
function generateDisplayId() {
  const num = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = chars[Math.floor(Math.random() * 26)];
  const l2 = chars[Math.floor(Math.random() * 26)];
  return `GS${num}${l1}${l2}`;
}

// Input validation helper — lightweight alternative to zod
function validateBody(body, schema) {
  const errors = [];
  for (const [key, rules] of Object.entries(schema)) {
    const val = body?.[key];
    if (rules.required && (val === undefined || val === null || val === '')) {
      errors.push(`${key} is required`);
      continue;
    }
    if (val !== undefined && val !== null) {
      if (rules.type && typeof val !== rules.type) errors.push(`${key} must be ${rules.type}`);
      if (rules.type === 'string' && typeof val === 'string') {
        if (rules.maxLength && val.length > rules.maxLength) errors.push(`${key} exceeds max length ${rules.maxLength}`);
        if (rules.pattern && !rules.pattern.test(val)) errors.push(`${key} has invalid format`);
      }
      if (rules.isArray && !Array.isArray(val)) errors.push(`${key} must be an array`);
      if (rules.isArray && Array.isArray(val) && rules.maxItems && val.length > rules.maxItems) errors.push(`${key} exceeds max items ${rules.maxItems}`);
    }
  }
  return errors.length ? errors : null;
}

// Admin-only middleware — must be used AFTER authMiddleware
function adminOnly(req, res, next) {
  if (!isAdminEmail(req.userEmail)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// Trust proxy (behind Nginx reverse proxy)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS — lock to allowed origins
const ALLOWED_ORIGINS = [
  ...(process.env.FRONTEND_URL || 'http://localhost:8080').split(',').map(s => s.trim()),
  'https://grandstate.io',
  'https://www.grandstate.io',
  'http://localhost:8080',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // In production, reject requests with no Origin header (server-to-server / curl)
    // Exception: health check and same-host requests are handled separately
    if (!origin) {
      // Only allow no-origin for internal health checks (same server)
      return callback(null, false);
    }
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  message: { success: false, error: 'Too many requests, please try again later' },
  skip: (req) => {
    const skipPaths = ['/session/active-users', '/session/presence', '/group-automation/status', '/marketplace-automation/status', '/group-automation/queue-status', '/health-check', '/worker-slots'];
    // Use exact path match (endsWith) to prevent bypass via substring injection
    return skipPaths.some(p => req.path === p || req.path.endsWith(p));
  },
});
app.use('/api/', apiLimiter);

// ── Server-side package resolver ── verifies actual package from DB, cached per session
// SECURITY: Never trust userPackage from frontend — always resolve from Supabase
async function resolveUserPackage(userId) {
  // Check cache first (valid for 5 minutes)
  const session = sessionManager.getSession(userId);
  if (session._verifiedPkg && session._verifiedPkgAt && Date.now() - session._verifiedPkgAt < 5 * 60 * 1000) {
    return session._verifiedPkg;
  }
  // Admin bypass
  if (isAdminEmail(session?.email)) {
    session._verifiedPkg = 'elite';
    session._verifiedPkgAt = Date.now();
    return 'elite';
  }
  try {
    const supaUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    const resp = await fetch(
      `${supaUrl}/rest/v1/license_keys?bound_user_id=eq.${userId}&is_active=eq.true&select=package,expires_at&order=created_at.desc&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (resp.ok) {
      const rows = await resp.json();
      if (rows.length > 0) {
        const lic = rows[0];
        const expired = lic.expires_at && new Date(lic.expires_at) < new Date();
        const pkg = expired ? 'free' : (lic.package || 'free');
        session._verifiedPkg = pkg;
        session._verifiedPkgAt = Date.now();
        return pkg;
      }
    }
  } catch (e) {
    console.error('resolveUserPackage error:', e.message);
  }
  session._verifiedPkg = 'free';
  session._verifiedPkgAt = Date.now();
  return 'free';
}

// Session middleware — runs after auth, attaches per-user session to req
// Also touches presence so every authenticated call keeps the user visible in admin stats
function attachSession(req, res, next) {
  const session = sessionManager.getSession(req.userId);
  sessionManager.touchPresence(req.userId, req.userEmail, req.userMeta);
  req.session = session;
  req.groupWorker = session.groupWorker;
  req.marketplaceWorker = session.marketplaceWorker;
  req.postingTracker = session.postingTracker;
  req.scheduler = session.scheduler;
  next();
}

// Combine auth + session into one middleware array
const auth = [authMiddleware, attachSession];
const adminAuth = [authMiddleware, adminOnly, attachSession];

// Health endpoint (no auth required)
app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'GrandState API is running', uptime: Math.floor(process.uptime()) });
});

// Resolve short Google Maps URL → full URL with coordinates (no auth required)
// SECURITY: Only allows Google Maps short URLs to prevent SSRF attacks
const ALLOWED_SHORT_DOMAINS = ['maps.app.goo.gl', 'goo.gl'];
const ALLOWED_RESOLVED_DOMAINS = ['www.google.com', 'maps.google.com', 'google.com', 'maps.app.goo.gl'];

app.post('/api/maps/resolve-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || url.length > 500) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return res.status(400).json({ success: false, error: 'Invalid URL format' }); }

    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ success: false, error: 'Only HTTPS URLs are allowed' });
    }

    const isShortUrl = ALLOWED_SHORT_DOMAINS.includes(parsedUrl.hostname);
    if (!isShortUrl) {
      if (ALLOWED_RESOLVED_DOMAINS.includes(parsedUrl.hostname)) {
        return res.json({ success: true, resolvedUrl: url });
      }
      return res.status(400).json({ success: false, error: 'Only Google Maps URLs are supported' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clearTimeout(timeout);

    const finalUrl = response.url;
    const resolvedParsed = new URL(finalUrl);
    if (!ALLOWED_RESOLVED_DOMAINS.includes(resolvedParsed.hostname)) {
      return res.status(400).json({ success: false, error: 'Resolved URL is not a Google Maps URL' });
    }

    res.json({ success: true, resolvedUrl: finalUrl });
  } catch (error) {
    console.error('Error resolving maps URL:', error.message);
    res.status(500).json({ success: false, error: 'Failed to resolve URL' });
  }
});

// ============================================
// MOUNT ROUTE MODULES
// ============================================
const deps = { auth, adminAuth, sessionManager, automationQueue, ADMIN_EMAILS, validateBody, generateDisplayId, resolveUserPackage, isAdminEmail };

app.use('/api', createUserRoutes(deps));
app.use('/api', createPostingRoutes(deps));
app.use('/api', createGroupRoutes(deps));
app.use('/api', createAutomationRoutes(deps));
app.use('/api', createFacebookRoutes(deps));
app.use('/api', createAdminRoutes(deps));
app.use('/api', createAnalyticsRoutes(deps));
app.use('/api', createScheduleRoutes(deps));

// ── Global error handlers — keep the process alive ──
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`🚀 GrandState API running on http://localhost:${PORT}`);
  console.log(`🔒 CORS: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`🌐 Multi-user: max ${10} concurrent browsers`);
  console.log(`📋 Auth: Supabase JWT required on all /api/* routes`);
  console.log(`💡 Health: GET /api/ping (no auth)`);
  console.log(`📦 Routes: 8 modules loaded`);
  if (ADMIN_EMAILS.length === 0) {
    console.warn('⚠️  ADMIN_EMAILS is empty — /api/admin/* endpoints will reject ALL requests');
  } else {
    console.log(`🛡️  Admin emails: ${ADMIN_EMAILS.join(', ')}`);
  }
});
