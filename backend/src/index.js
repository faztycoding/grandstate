import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { authMiddleware } from './middleware/auth.js';
import { sessionManager } from './services/userSessionManager.js';
import { automationQueue } from './services/automationQueue.js';

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
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  message: { success: false, error: 'Too many requests, please try again later' },
  skip: (req) => {
    const skipPaths = ['/session/active-users', '/session/presence', '/group-automation/status', '/marketplace-automation/status', '/group-automation/queue-status', '/health-check', '/worker-slots'];
    return skipPaths.some(p => req.path.includes(p));
  },
});
app.use('/api/', apiLimiter);

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
  res.json({ success: true, message: 'GrandState API is running', sessions: sessionManager.getStats(), queue: { maxConcurrent: automationQueue.maxConcurrent, running: automationQueue.running.size, queued: automationQueue.queue.length } });
});

// Resolve short Google Maps URL → full URL with coordinates (no auth required)
app.post('/api/maps/resolve-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Only resolve short URLs that need expansion
    const isShortUrl = url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');
    if (!isShortUrl) {
      return res.json({ success: true, resolvedUrl: url });
    }

    // Follow redirects to get the final URL
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const finalUrl = response.url;
    res.json({ success: true, resolvedUrl: finalUrl });
  } catch (error) {
    console.error('Error resolving maps URL:', error.message);
    res.status(500).json({ success: false, error: 'Failed to resolve URL' });
  }
});

// Presence heartbeat (auth required)
// online=true  => touch presence
// online=false => mark user as offline immediately
app.post('/api/session/presence', ...auth, (req, res) => {
  try {
    const isOnline = req.body?.online !== false;
    if (isOnline) {
      sessionManager.touchPresence(req.userId, req.userEmail, req.userMeta);
    } else {
      sessionManager.markOffline(req.userId);
    }

    res.json({
      success: true,
      online: isOnline,
      ...sessionManager.getPresenceStats(ADMIN_EMAILS),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User profile — returns display_id (auto-generates if missing)
app.get('/api/user/profile', ...auth, async (req, res) => {
  try {
    const supaUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    // Fetch from public.users
    const resp = await fetch(`${supaUrl}/rest/v1/users?id=eq.${req.userId}&select=id,email,full_name,display_id`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
    });

    let profile = null;
    if (resp.ok) {
      const rows = await resp.json();
      profile = rows[0] || null;
    }

    // If user exists but has no display_id, generate one
    if (profile && !profile.display_id) {
      const newId = generateDisplayId();
      await fetch(`${supaUrl}/rest/v1/users?id=eq.${req.userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ display_id: newId }),
      });
      profile.display_id = newId;
      console.log(`🆔 Generated display_id ${newId} for user ${req.userId.substring(0, 8)}`);
    }

    // If user doesn't exist in public.users yet, create row
    if (!profile) {
      const newId = generateDisplayId();
      await fetch(`${supaUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: req.userId, email: req.userEmail || 'unknown', display_id: newId }),
      });
      profile = { id: req.userId, email: req.userEmail, display_id: newId };
      console.log(`🆔 Created user row + display_id ${newId} for ${req.userId.substring(0, 8)}`);
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('User profile error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// User real stats — actual posts today, groups count, properties count
app.get('/api/user/real-stats', ...auth, async (req, res) => {
  try {
    const userId = req.userId;
    const supaUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    const headers = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

    // 1. Posts today from PostingTracker (in-memory via sessionManager)
    let postsToday = 0;
    let automationRuns = 0;
    try {
      const session = sessionManager.sessions.get(userId);
      if (session?.postingTracker) {
        const todayStats = session.postingTracker.getTodayStats('elite');
        postsToday = todayStats.postsCount || 0;
        automationRuns = todayStats.automationRuns || 0;
      } else {
        // Fallback: read from disk
        const { PostingTracker } = await import('./services/postingTracker.js');
        const pt = new PostingTracker(userId);
        const ts = pt.getTodayStats('elite');
        postsToday = ts.postsCount || 0;
        automationRuns = ts.automationRuns || 0;
      }
    } catch (e) { /* non-critical */ }

    // 2. Groups count from Supabase
    let groupsCount = 0;
    try {
      const r = await fetch(`${supaUrl}/rest/v1/facebook_groups?user_id=eq.${userId}&select=id`, {
        headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' },
      });
      const ct = r.headers.get('content-range');
      if (ct) groupsCount = parseInt(ct.split('/')[1] || '0', 10) || 0;
      else { const d = await r.json(); groupsCount = Array.isArray(d) ? d.length : 0; }
    } catch (e) { /* non-critical */ }

    // 3. Properties count from Supabase
    let propertiesCount = 0;
    try {
      const r = await fetch(`${supaUrl}/rest/v1/properties?user_id=eq.${userId}&select=id`, {
        headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' },
      });
      const ct = r.headers.get('content-range');
      if (ct) propertiesCount = parseInt(ct.split('/')[1] || '0', 10) || 0;
      else { const d = await r.json(); propertiesCount = Array.isArray(d) ? d.length : 0; }
    } catch (e) { /* non-critical */ }

    res.json({ success: true, postsToday, automationRuns, groupsCount, propertiesCount, syncedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Active users count for sidebar display
app.get('/api/session/active-users', ...auth, (req, res) => {
  try {
    // A successful authenticated poll implies user is online right now
    sessionManager.touchPresence(req.userId, req.userEmail, req.userMeta);
    res.json({ success: true, ...sessionManager.getPresenceStats(ADMIN_EMAILS) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin stats — detailed active users + automation + queue info
app.get('/api/admin/stats', ...adminAuth, (req, res) => {
  try {
    const adminStats = sessionManager.getAdminStats();
    const queueStats = automationQueue.getQueueStats();
    res.json({ success: true, ...adminStats, queue: queueStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin stats SSE stream — Real-time updates (Elon Musk Level)
app.get('/api/admin/stats/stream', ...adminAuth, (req, res) => {
  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Function to send current stats
  const sendStats = () => {
    try {
      const adminStats = sessionManager.getAdminStats();
      const queueStats = automationQueue.getQueueStats();
      const data = JSON.stringify({ success: true, ...adminStats, queue: queueStats });
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('SSE send error:', err.message);
    }
  };

  // Send initial data immediately
  sendStats();

  // Stream data every 1 second
  const intervalId = setInterval(sendStats, 1000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Debug: check user data in DB (admin-only — service key bypasses RLS)
app.get('/api/debug/my-data', ...adminAuth, async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);

    const { data: groups, error: gErr } = await supa
      .from('facebook_groups').select('id, user_id, name, created_at').eq('user_id', req.userId);
    const { data: props, error: pErr } = await supa
      .from('properties').select('id, user_id, title, created_at').eq('user_id', req.userId);

    // Also check ALL data (any user_id)
    const { data: allGroups } = await supa.from('facebook_groups').select('id, user_id, name').limit(20);
    const { data: allProps } = await supa.from('properties').select('id, user_id, title').limit(20);

    res.json({
      success: true,
      userId: req.userId,
      myGroups: { count: groups?.length || 0, data: groups, error: gErr?.message },
      myProperties: { count: props?.length || 0, data: props, error: pErr?.message },
      allGroups: { count: allGroups?.length || 0, data: allGroups },
      allProperties: { count: allProps?.length || 0, data: allProps },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoints

// ============================================
// POSTING TRACKER ENDPOINTS
// ============================================

// Today's stats (daily usage, limit, next reset)
app.get('/api/posting/today', ...auth, (req, res) => {
  const { userPackage } = req.query;
  res.json({ success: true, ...req.postingTracker.getTodayStats(userPackage || 'free') });
});

// Pre-flight check before starting automation
app.post('/api/posting/preflight', ...auth, (req, res) => {
  const { propertyId, groupIds, userPackage } = req.body;
  if (!propertyId || !groupIds) {
    return res.status(400).json({ success: false, error: 'propertyId and groupIds required' });
  }
  const result = req.postingTracker.preflightCheck(propertyId, groupIds, userPackage || 'free');
  res.json({ success: true, ...result });
});

// Daily history (last N days)
app.get('/api/posting/history', ...auth, (req, res) => {
  const { days } = req.query;
  res.json({ success: true, days: req.postingTracker.getDailyHistory(parseInt(days) || 7) });
});

// Full posting history
app.get('/api/posting-history', ...auth, (req, res) => {
  res.json({ success: true, history: req.postingTracker.getHistory() });
});

// Property-specific posting history
app.get('/api/posting-history/:propertyId', ...auth, (req, res) => {
  const { propertyId } = req.params;
  res.json({
    success: true,
    history: req.postingTracker.getPropertyHistory(propertyId)
  });
});

// Available groups (not yet posted today)
app.get('/api/available-groups/:propertyId', ...auth, (req, res) => {
  const { propertyId } = req.params;
  const { groupIds, cooldownHours } = req.query;

  const allGroupIds = groupIds ? groupIds.split(',') : [];
  const available = req.postingTracker.filterAvailableGroups(
    propertyId,
    allGroupIds,
    parseInt(cooldownHours) || 24
  );

  res.json({ success: true, availableGroups: available });
});

// Fetch Facebook Group Info (name, member count)
app.post('/api/groups/fetch-info', ...auth, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.includes('facebook.com/groups')) {
      return res.status(400).json({ success: false, error: 'Invalid Facebook group URL' });
    }

    const groupWorker = req.groupWorker;

    // Initialize browser if needed
    if (!req.groupWorker.browser || !req.groupWorker.browser.isConnected()) {
      if (!sessionManager.canStartBrowser()) {
        return res.status(429).json({ success: false, error: 'Server busy — too many active browsers. Please try again later.' });
      }
      await req.groupWorker.initialize();
      sessionManager.registerBrowserStart();
    }

    const page = req.groupWorker.page;

    // Navigate to the group's ABOUT page to get activity info
    // Convert URL to /about page: https://www.facebook.com/groups/XXX -> https://www.facebook.com/groups/XXX/about
    let aboutUrl = url.replace(/\/$/, ''); // Remove trailing slash
    if (!aboutUrl.includes('/about')) {
      aboutUrl = aboutUrl + '/about';
    }

    // Extract group slug from URL for fallback attempts
    const groupSlug = url.match(/facebook\.com\/groups\/([^/?#]+)/)?.[1] || '';

    console.log('Fetching group info from:', aboutUrl);
    await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    let actualUrl = page.url();
    console.log(`🔍 [DEBUG] Landed on: ${actualUrl}`);
    console.log(`🔍 [DEBUG] Page title: ${await page.title()}`);

    // If redirected to login, try strategies to get the group page
    const isOnLogin = () => {
      const u = page.url();
      return u.includes('/login') || u.includes('login.php');
    };

    if (isOnLogin()) {
      // Strategy 1: Visit facebook.com to get initial cookies, then retry
      console.log('🔄 [Strategy 1] Getting FB cookies first...');
      try {
        await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
        // Now try the group about page again
        await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000));
        console.log(`🔍 [Strategy 1] Now on: ${page.url()}`);
      } catch (e) {
        console.log(`⚠️ [Strategy 1] Error: ${e.message}`);
      }
    }

    if (isOnLogin()) {
      // Strategy 2: Try m.facebook.com (mobile) — less aggressive redirects
      console.log('🔄 [Strategy 2] Trying m.facebook.com...');
      try {
        const mobileUrl = `https://m.facebook.com/groups/${groupSlug}/about`;
        await page.goto(mobileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000));
        console.log(`🔍 [Strategy 2] Now on: ${page.url()}`);
      } catch (e) {
        console.log(`⚠️ [Strategy 2] Error: ${e.message}`);
      }
    }

    if (isOnLogin()) {
      // Strategy 3: Try mbasic.facebook.com — minimal JS, often no redirect
      console.log('🔄 [Strategy 3] Trying mbasic.facebook.com...');
      try {
        const mbasicUrl = `https://mbasic.facebook.com/groups/${groupSlug}?v=info`;
        await page.goto(mbasicUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));
        console.log(`🔍 [Strategy 3] Now on: ${page.url()}`);
      } catch (e) {
        console.log(`⚠️ [Strategy 3] Error: ${e.message}`);
      }
    }

    actualUrl = page.url();
    console.log(`🔍 [FINAL] On page: ${actualUrl} | Title: ${await page.title()}`);

    // Wait for render
    await new Promise(r => setTimeout(r, 2000));

    // Close Facebook login popup overlay ("See more on Facebook" dialog)
    try {
      const closedPopup = await page.evaluate(() => {
        // aria-label="Close" button
        const closeBtn = document.querySelector('[aria-label="Close"][role="button"]');
        if (closeBtn) { closeBtn.click(); return 'aria-label'; }
        // role="dialog" close button
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const btn = dialog.querySelector('[aria-label="Close"], [aria-label="ปิด"]');
          if (btn) { btn.click(); return 'dialog-close'; }
        }
        // Any overlay close
        const overlays = document.querySelectorAll('[role="button"]');
        for (const el of overlays) {
          const label = el.getAttribute('aria-label') || '';
          if (label === 'Close' || label === 'ปิด') { el.click(); return 'overlay-close'; }
        }
        return null;
      });
      if (closedPopup) {
        console.log(`✅ Closed login popup via: ${closedPopup}`);
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      // silent
    }

    await new Promise(r => setTimeout(r, 500));

    // Scroll down to trigger lazy-loaded activity section
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.5);
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 2000));
    // Scroll back up so we can capture the full page text
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 500));

    // Try to extract group name and member count
    const groupInfo = await page.evaluate(() => {
      let name = '';
      let memberCount = 0;

      // Blacklist: texts that are NOT group names (FB UI elements)
      const blacklist = [
        'การแจ้งเตือน', 'แชท', 'Chat', 'Notifications', 'Messenger',
        'Facebook', 'หน้าหลัก', 'Home', 'Watch', 'Marketplace',
        'สร้าง', 'Create', 'เมนู', 'Menu',
        'Groups', 'กลุ่ม', 'Group', 'กลุ่มของคุณ', 'Your groups',
        'เข้าร่วมกลุ่ม', 'Join group', 'ค้นพบ', 'Discover',
      ];
      const isBlacklisted = (text) => blacklist.some(b => text === b || text.startsWith(b + ' '));

      // ======= FIND GROUP NAME =======
      // Strategy 1 (BEST): og:title meta tag — most reliable
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        const ogText = ogTitle.getAttribute('content')?.trim() || '';
        if (ogText && ogText.length > 2 && !isBlacklisted(ogText)) {
          name = ogText;
        }
      }

      // Strategy 2: <title> tag — "GroupName | Facebook"
      if (!name) {
        const title = document.title || '';
        if (title.includes('|')) {
          const candidate = title.split('|')[0].trim();
          if (candidate && candidate.length > 2 && !isBlacklisted(candidate)) {
            name = candidate;
          }
        } else if (title.includes('-')) {
          const candidate = title.split('-')[0].trim();
          if (candidate && candidate.length > 2 && !isBlacklisted(candidate)) {
            name = candidate;
          }
        }
      }

      // Strategy 3: h1 > span — skip blacklisted texts
      if (!name) {
        const h1Elements = document.querySelectorAll('h1');
        for (const h1 of h1Elements) {
          const span = h1.querySelector('span');
          const text = span ? (span.textContent?.trim() || '') : (h1.textContent?.trim() || '');
          if (text && text.length > 2 && !isBlacklisted(text)) {
            name = text;
            break;
          }
        }
      }

      // Strategy 4: aria-label on group header links
      if (!name) {
        const groupLinks = document.querySelectorAll('a[href*="/groups/"]');
        for (const link of groupLinks) {
          const ariaLabel = link.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.length > 5 && !isBlacklisted(ariaLabel)) {
            name = ariaLabel;
            break;
          }
        }
      }

      // ======= FIND MEMBER COUNT =======
      const bodyText = document.body.innerText;
      let match;

      // Helper: parse Thai unit multiplier
      const thaiUnits = { 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };

      // ── Thai: "สมาชิก X.X [หมื่น/แสน/ล้าน/พัน]" (สมาชิก comes first)
      match = bodyText.match(/สมาชิก\s*([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)/);
      if (match) {
        memberCount = Math.round(parseFloat(match[1].replace(',', '.')) * (thaiUnits[match[2]] || 1));
      }

      // ── Thai: "X.X [หมื่น/แสน/ล้าน/พัน] สมาชิก" (number comes first)
      if (!memberCount) {
        match = bodyText.match(/([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)\s*(?:คน\s*)?สมาชิก/);
        if (match) {
          memberCount = Math.round(parseFloat(match[1].replace(',', '.')) * (thaiUnits[match[2]] || 1));
        }
      }

      // ── Thai: "สมาชิก X,XXX คน" (plain number with คน)
      if (!memberCount) {
        match = bodyText.match(/สมาชิก\s*([\d,]+)\s*คน/);
        if (match) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // ── Thai: "สมาชิก X,XXX" (plain number without คน)
      if (!memberCount) {
        match = bodyText.match(/สมาชิก\s*([\d,]+)/);
        if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // ── Thai: "X,XXX สมาชิก" (number before สมาชิก)
      if (!memberCount) {
        match = bodyText.match(/([\d,]+)\s*สมาชิก/);
        if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // ── English: "X.XK members" or "XK members"
      if (!memberCount) {
        match = bodyText.match(/([\d.]+)\s*[Kk]\s*members/i);
        if (match) {
          memberCount = Math.round(parseFloat(match[1]) * 1000);
        }
      }

      // ── English: "X.XM members"
      if (!memberCount) {
        match = bodyText.match(/([\d.]+)\s*[Mm]\s*members/i);
        if (match) {
          memberCount = Math.round(parseFloat(match[1]) * 1000000);
        }
      }

      // ── English: "X,XXX members" (plain number)
      if (!memberCount) {
        match = bodyText.match(/([\d,]+)\s*members/i);
        if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // ── English: "X,XXX total members"
      if (!memberCount) {
        match = bodyText.match(/([\d,]+)\s*total\s*members/i);
        if (match) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // ── Mixed: "276K สมาชิก" (Latin K/M + Thai word)
      if (!memberCount) {
        match = bodyText.match(/([\d.]+)\s*[Kk]\s*(?:คน\s*)?สมาชิก/);
        if (match) {
          memberCount = Math.round(parseFloat(match[1]) * 1000);
        }
      }

      // ── Mixed: "1.2M สมาชิก" (Latin M + Thai word)
      if (!memberCount) {
        match = bodyText.match(/([\d.]+)\s*[Mm]\s*(?:คน\s*)?สมาชิก/);
        if (match) {
          memberCount = Math.round(parseFloat(match[1]) * 1000000);
        }
      }

      // ======= FIND LAST ACTIVITY =======
      let lastActivity = undefined;
      // Thai: "อัปเดต X วันที่ผ่านมา" / "อัปเดตเมื่อ X ชม. ที่ผ่านมา" etc.
      const lastActivityPatterns = [
        /อัปเดต(?:เมื่อ)?\s*(\d+)\s*(นาที|ชั่วโมง|ชม\.|วัน|สัปดาห์|เดือน|ปี)\s*ที่ผ่านมา/,
        /อัปเดต(?:ล่าสุด)?\s*(\d+)\s*(นาที|ชั่วโมง|ชม\.|วัน|สัปดาห์|เดือน|ปี)/,
        /Updated?\s*(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i,
      ];
      const activityUnits = {
        'นาที': 'minutes', 'ชั่วโมง': 'hours', 'ชม.': 'hours',
        'วัน': 'days', 'สัปดาห์': 'weeks', 'เดือน': 'months', 'ปี': 'years',
        'minute': 'minutes', 'hour': 'hours', 'day': 'days',
        'week': 'weeks', 'month': 'months', 'year': 'years',
      };
      for (const pat of lastActivityPatterns) {
        const m = bodyText.match(pat);
        if (m) {
          const num = parseInt(m[1]);
          const unit = activityUnits[m[2]] || m[2];
          lastActivity = `${num} ${unit} ago`;
          break;
        }
      }
      // Also try: "อัปเดตวันนี้" / "Updated today" / "อัปเดตเมื่อวาน" / "Updated yesterday"
      if (!lastActivity) {
        if (/อัปเดต.*วันนี้|Updated.*today/i.test(bodyText)) lastActivity = 'today';
        else if (/อัปเดต.*เมื่อวาน|Updated.*yesterday/i.test(bodyText)) lastActivity = 'yesterday';
      }

      // ======= FIND POSTS TODAY & LAST MONTH FROM ACTIVITY SECTION =======
      let postsToday;
      let postsLastMonth;

      const parseCompactMetric = (rawValue) => {
        if (!rawValue) return undefined;
        const compact = String(rawValue)
          .replace(/\u00A0/g, ' ')
          .trim()
          .replace(/\s+/g, '');

        const matched = compact.match(/^([\d.,]+)([KkMm]|พัน|หมื่น|แสน|ล้าน)?$/);
        if (!matched) return undefined;

        const numberPart = matched[1];
        const suffix = matched[2] || '';

        let normalized = numberPart;
        if (numberPart.includes('.') && numberPart.includes(',')) {
          normalized = numberPart.replace(/,/g, '');
        } else if (!numberPart.includes('.') && /,\d{1,2}$/.test(numberPart)) {
          normalized = numberPart.replace(',', '.');
        } else {
          normalized = numberPart.replace(/,/g, '');
        }

        const base = parseFloat(normalized);
        if (!Number.isFinite(base)) return undefined;

        const normalizedSuffix = suffix === 'K' ? 'k' : (suffix === 'M' ? 'm' : suffix);
        const multipliers = {
          k: 1000,
          m: 1000000,
          'พัน': 1000,
          'หมื่น': 10000,
          'แสน': 100000,
          'ล้าน': 1000000,
        };

        const multiplier = multipliers[normalizedSuffix] || 1;
        return Math.round(base * multiplier);
      };

      // ─── Use \s which matches newlines too, so split-element text still matches ───
      const countToken = '([\\d.,]+\\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)';
      const todayPatterns = [
        new RegExp(`${countToken}\\s*โพสต์ใหม่ในวันนี้`, 'i'),
        new RegExp(`${countToken}\\s*โพสต์ใหม่วันนี้`, 'i'),
        new RegExp(`${countToken}\\s*โพสต์\\s*วันนี้`, 'i'),
        new RegExp(`${countToken}\\s*new\\s*posts?\\s*today`, 'i'),
        new RegExp(`โพสต์ใหม่ในวันนี้\\s*[:\\-]?\\s*${countToken}`, 'i'),
        new RegExp(`new\\s*posts?\\s*today\\s*[:\\-]?\\s*${countToken}`, 'i'),
        new RegExp(`${countToken}\\s*[\\-–]\\s*โพสต์(?:ใหม่)?(?:ใน)?วันนี้`, 'i'),
        new RegExp(`${countToken}\\s*[\\-–]\\s*new\\s*posts?\\s*today`, 'i'),
        // Facebook sometimes shows: "วันนี้มีโพสต์ใหม่ X โพสต์"
        new RegExp(`วันนี้.*?(\\d[\\d.,]*)\\s*โพสต์`, 'i'),
        // "โพสต์วันนี้ X" (label first, then number)
        new RegExp(`โพสต์(?:ใหม่)?\\s*(?:ใน)?วันนี้\\s*${countToken}`, 'i'),
        // "today X posts" / "today: X"
        new RegExp(`today\\s*[:\\-]?\\s*${countToken}\\s*posts?`, 'i'),
      ];

      const monthPatterns = [
        new RegExp(`${countToken}\\s*โพสต์ในเดือนที่ผ่านมา`, 'i'),
        new RegExp(`${countToken}\\s*โพสต์เมื่อเดือนที่แล้ว`, 'i'),
        new RegExp(`${countToken}\\s*โพสต์ต่อเดือน`, 'i'),
        new RegExp(`${countToken}\\s*โพสต์\\s*\\/\\s*เดือน`, 'i'),
        new RegExp(`${countToken}\\s*โพสต์ในช่วง\\s*30\\s*วันที่ผ่านมา`, 'i'),
        new RegExp(`${countToken}\\s*posts?\\s*in\\s*the\\s*last\\s*month`, 'i'),
        new RegExp(`${countToken}\\s*posts?\\s*last\\s*month`, 'i'),
        new RegExp(`${countToken}\\s*posts?\\s*\\/\\s*month`, 'i'),
        new RegExp(`${countToken}\\s*posts?\\s*in\\s*the\\s*last\\s*30\\s*days`, 'i'),
        new RegExp(`โพสต์ในเดือนที่ผ่านมา\\s*[:\\-]?\\s*${countToken}`, 'i'),
        new RegExp(`posts?\\s*in\\s*the\\s*last\\s*month\\s*[:\\-]?\\s*${countToken}`, 'i'),
        new RegExp(`${countToken}\\s*[\\-–]\\s*โพสต์\\s*\\/\\s*เดือน`, 'i'),
        new RegExp(`${countToken}\\s*[\\-–]\\s*โพสต์ต่อเดือน`, 'i'),
        new RegExp(`${countToken}\\s*[\\-–]\\s*posts?\\s*\\/\\s*month`, 'i'),
        // "เดือนที่ผ่านมามีโพสต์ X โพสต์"
        new RegExp(`เดือน(?:ที่ผ่านมา|ที่แล้ว).*?(\\d[\\d.,]*)\\s*โพสต์`, 'i'),
        // "โพสต์/เดือน X" or "โพสต์ต่อเดือน X" (label first)
        new RegExp(`โพสต์\\s*(?:\\/|ต่อ)\\s*เดือน\\s*${countToken}`, 'i'),
        // "last month X posts"
        new RegExp(`last\\s*month\\s*[:\\-]?\\s*${countToken}\\s*posts?`, 'i'),
        // KEY: Facebook English shows just "10,000 in the last month" (no "posts" word!)
        new RegExp(`${countToken}\\s*in\\s*the\\s*last\\s*month`, 'i'),
        // "X in the last 30 days" (without "posts")
        new RegExp(`${countToken}\\s*in\\s*the\\s*last\\s*30\\s*days`, 'i'),
      ];

      const extractMetricFromText = (text, patterns) => {
        for (const pattern of patterns) {
          const matched = text.match(pattern);
          if (matched && matched[1]) {
            const parsed = parseCompactMetric(matched[1]);
            if (typeof parsed === 'number') {
              return parsed;
            }
          }
        }
        return undefined;
      };

      // Search all spans with specific Facebook class patterns
      const allSpans = document.querySelectorAll('span');

      // DEBUG: Log texts that contain keywords for diagnosis
      const debugTexts = [];

      allSpans.forEach(span => {
        const text = span.textContent?.trim() || '';

        // Collect ALL texts with numbers near post/โพสต์/เดือน/month/วันนี้ for debugging
        if (text.length > 0 && text.length < 200 && (
          (text.match(/\d/) && (text.includes('โพสต์') || text.includes('post') || text.includes('เดือน') || text.includes('month') || text.includes('วันนี้') || text.includes('today'))) ||
          text.includes('กิจกรรม') || text.includes('activity')
        )) {
          debugTexts.push(text.substring(0, 120));
        }

        if (postsToday === undefined) {
          const value = extractMetricFromText(text, todayPatterns);
          if (value !== undefined) postsToday = value;
        }

        if (postsLastMonth === undefined) {
          const value = extractMetricFromText(text, monthPatterns);
          if (value !== undefined) postsLastMonth = value;
        }
      });

      // ── Fallback A: Adjacent-element extraction ──
      // Facebook often renders: <span>780</span><span>โพสต์ใหม่ในวันนี้</span>
      // Walk through spans to find number-only spans next to label spans
      if (postsToday === undefined || postsLastMonth === undefined) {
        const todayLabels = ['โพสต์ใหม่ในวันนี้', 'โพสต์ใหม่วันนี้', 'โพสต์วันนี้', 'new posts today', 'new post today'];
        const monthLabels = ['โพสต์ในเดือนที่ผ่านมา', 'โพสต์เมื่อเดือนที่แล้ว', 'โพสต์ต่อเดือน', 'โพสต์/เดือน', 'โพสต์ในช่วง 30 วันที่ผ่านมา', 'posts in the last month', 'posts last month', 'posts/month'];

        allSpans.forEach(span => {
          const text = (span.textContent?.trim() || '').toLowerCase();

          const matchLabel = (labels) => labels.some(l => text === l.toLowerCase() || text.includes(l.toLowerCase()));

          // If this span is a label, look for a number in previous sibling or parent's previous child
          if (matchLabel(todayLabels) && postsToday === undefined) {
            // Check previous sibling element
            let prev = span.previousElementSibling;
            if (!prev && span.parentElement) prev = span.parentElement.previousElementSibling;
            if (!prev && span.parentElement?.parentElement) {
              const parent = span.parentElement.parentElement;
              const children = Array.from(parent.children);
              const idx = children.indexOf(span.parentElement);
              if (idx > 0) prev = children[idx - 1];
            }
            if (prev) {
              const prevText = (prev.textContent?.trim() || '');
              const val = parseCompactMetric(prevText);
              if (typeof val === 'number') {
                postsToday = val;
                debugTexts.push(`[ADJ-TODAY] "${prevText}" + "${text}"`);
              }
            }
          }

          if (matchLabel(monthLabels) && postsLastMonth === undefined) {
            let prev = span.previousElementSibling;
            if (!prev && span.parentElement) prev = span.parentElement.previousElementSibling;
            if (!prev && span.parentElement?.parentElement) {
              const parent = span.parentElement.parentElement;
              const children = Array.from(parent.children);
              const idx = children.indexOf(span.parentElement);
              if (idx > 0) prev = children[idx - 1];
            }
            if (prev) {
              const prevText = (prev.textContent?.trim() || '');
              const val = parseCompactMetric(prevText);
              if (typeof val === 'number') {
                postsLastMonth = val;
                debugTexts.push(`[ADJ-MONTH] "${prevText}" + "${text}"`);
              }
            }
          }
        });
      }

      // ── Fallback B: Search in bodyText ──
      if (postsToday === undefined || postsLastMonth === undefined) {
        const postsBodyText = document.body.innerText;

        if (postsToday === undefined) {
          postsToday = extractMetricFromText(postsBodyText, todayPatterns);
        }

        if (postsLastMonth === undefined) {
          postsLastMonth = extractMetricFromText(postsBodyText, monthPatterns);
        }

        // Match: "สมาชิกทั้งหมด XX,XXX ราย" (more accurate member count)
        const totalMemberMatch = postsBodyText.match(/สมาชิกทั้งหมด\s*([\d,]+)\s*ราย/);
        if (totalMemberMatch) {
          memberCount = parseInt(totalMemberMatch[1].replace(/,/g, ''));
        }
      }

      // ── Fallback C: Line-based extraction from bodyText ──
      // If still no posts data, split bodyText into lines and look for number followed by label on next line
      if (postsToday === undefined || postsLastMonth === undefined) {
        const lines = document.body.innerText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
        for (let li = 0; li < lines.length - 1; li++) {
          const numLine = lines[li];
          const labelLine = lines[li + 1].toLowerCase();

          if (postsToday === undefined && (labelLine.includes('โพสต์ใหม่') && labelLine.includes('วันนี้') || labelLine.includes('new post') && labelLine.includes('today'))) {
            const val = parseCompactMetric(numLine);
            if (typeof val === 'number') {
              postsToday = val;
              debugTexts.push(`[LINE-TODAY] "${numLine}" / "${lines[li + 1]}"`);
            }
          }

          if (postsLastMonth === undefined && (labelLine.includes('โพสต์') && (labelLine.includes('เดือน') || labelLine.includes('30 วัน')) || labelLine.includes('post') && (labelLine.includes('month') || labelLine.includes('30 day')))) {
            const val = parseCompactMetric(numLine);
            if (typeof val === 'number') {
              postsLastMonth = val;
              debugTexts.push(`[LINE-MONTH] "${numLine}" / "${lines[li + 1]}"`);
            }
          }
        }
      }

      // Clean name: remove "(N) " notification count prefix from FB page titles
      if (name) {
        name = name.replace(/^\(\d+\)\s*/, '').trim();
      }

      return { name, memberCount, postsToday, postsLastMonth, lastActivity, debugTexts };
    });

    // Debug logging
    if (groupInfo.debugTexts && groupInfo.debugTexts.length > 0) {
      console.log(`🔍 Debug: Found ${groupInfo.debugTexts.length} span texts with numbers + 'post/โพสต์':`);
      console.log(groupInfo.debugTexts.slice(0, 10)); // Show first 10 matches
    }
    console.log(`📊 Scraped: ${groupInfo.name?.substring(0, 40)} | Members: ${groupInfo.memberCount} | Today: ${groupInfo.postsToday} | Month: ${groupInfo.postsLastMonth} | Activity: ${groupInfo.lastActivity || '-'}`);

    // Browser stays open for reuse by this user's session

    res.json({
      success: true,
      groupInfo: {
        name: groupInfo.name || '',
        memberCount: groupInfo.memberCount || 0,
        postsToday: typeof groupInfo.postsToday === 'number' ? groupInfo.postsToday : undefined,
        postsLastMonth: typeof groupInfo.postsLastMonth === 'number' ? groupInfo.postsLastMonth : undefined,
        lastActivity: groupInfo.lastActivity || null,
        url: url,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Fetch group info error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// Background Group Update Job System
// ====================================
// In-memory job store: userId → job state
const groupUpdateJobs = new Map();

// Start background update of all active groups
app.post('/api/groups/update-all', ...auth, async (req, res) => {
  try {
    const { groups } = req.body; // Array of { id, url, name, memberCount, postsToday, postsLastMonth }
    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ success: false, error: 'groups array is required' });
    }

    // Check if already running for this user
    const existing = groupUpdateJobs.get(req.userId);
    if (existing && existing.status === 'running') {
      return res.json({ success: true, message: 'already_running', jobId: existing.jobId, current: existing.current, total: existing.total });
    }

    const jobId = `gu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      jobId,
      userId: req.userId,
      status: 'running',
      total: groups.length,
      current: 0,
      success: 0,
      failed: 0,
      currentGroupName: '',
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
    };
    groupUpdateJobs.set(req.userId, job);

    // Respond immediately — job runs in background
    res.json({ success: true, jobId, total: groups.length, message: 'started' });

    // ── Background processing (fire-and-forget) ──
    const supaUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    const groupWorker = req.groupWorker;

    // Blacklist for group names (FB UI elements)
    const nameBlacklist = [
      'การแจ้งเตือน', 'แชท', 'Chat', 'Notifications', 'Messenger',
      'Facebook', 'หน้าหลัก', 'Home', 'Watch', 'Marketplace',
      'สร้าง', 'Create', 'เมนู', 'Menu',
      'Groups', 'กลุ่ม', 'Group', 'กลุ่มของคุณ', 'Your groups',
      'เข้าร่วมกลุ่ม', 'Join group', 'ค้นพบ', 'Discover',
    ];
    const isValidName = (name) => {
      if (!name || name.length < 3) return false;
      return !nameBlacklist.some(b => name === b || name.startsWith(b + ' '));
    };

    (async () => {
      try {
        // Initialize browser if needed
        if (!groupWorker.browser || !groupWorker.browser.isConnected()) {
          if (!sessionManager.canStartBrowser()) {
            job.status = 'error';
            job.error = 'Server busy — too many active browsers';
            job.finishedAt = Date.now();
            return;
          }
          await groupWorker.initialize();
          sessionManager.registerBrowserStart();
        }

        for (let i = 0; i < groups.length; i++) {
          // Check if cancelled
          if (job.status === 'cancelled') {
            console.log(`🛑 [BG-Update] Cancelled by user at ${i}/${groups.length}`);
            break;
          }

          const group = groups[i];
          job.current = i + 1;
          job.currentGroupName = group.name || `Group ${i + 1}`;

          try {
            // Call the same scraping logic: navigate to group /about page
            const page = groupWorker.page;
            let aboutUrl = group.url.replace(/\/$/, '');
            if (!aboutUrl.includes('/about')) aboutUrl += '/about';
            const groupSlug = group.url.match(/facebook\.com\/groups\/([^/?#]+)/)?.[1] || '';

            await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
              // Fallback: try domcontentloaded
              return page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            });

            // Handle login redirect
            const isOnLogin = () => {
              const u = page.url();
              return u.includes('/login') || u.includes('login.php');
            };

            if (isOnLogin()) {
              try {
                await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
                await new Promise(r => setTimeout(r, 2000));
                await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 3000));
              } catch (e) { /* silent */ }
            }
            if (isOnLogin()) {
              try {
                const mobileUrl = `https://m.facebook.com/groups/${groupSlug}/about`;
                await page.goto(mobileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 3000));
              } catch (e) { /* silent */ }
            }
            if (isOnLogin()) {
              try {
                const mbasicUrl = `https://mbasic.facebook.com/groups/${groupSlug}?v=info`;
                await page.goto(mbasicUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 2000));
              } catch (e) { /* silent */ }
            }

            // Close popup overlay
            await new Promise(r => setTimeout(r, 2000));
            try {
              await page.evaluate(() => {
                const closeBtn = document.querySelector('[aria-label="Close"][role="button"]') || document.querySelector('[aria-label="ปิด"][role="button"]');
                if (closeBtn) closeBtn.click();
              });
              await new Promise(r => setTimeout(r, 1000));
            } catch (e) { /* silent */ }

            // Scroll to load content
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
            await new Promise(r => setTimeout(r, 2000));
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise(r => setTimeout(r, 2000));
            await page.evaluate(() => window.scrollTo(0, 0));
            await new Promise(r => setTimeout(r, 500));

            // Extract group info (simplified — reuse same page.evaluate as fetch-info)
            const info = await page.evaluate(() => {
              let name = '';
              let memberCount = 0;
              const ogTitle = document.querySelector('meta[property="og:title"]');
              if (ogTitle) name = ogTitle.getAttribute('content')?.trim() || '';
              if (!name) {
                const title = document.title || '';
                if (title.includes('|')) name = title.split('|')[0].trim();
                else if (title.includes('-')) name = title.split('-')[0].trim();
              }
              if (name) name = name.replace(/^\(\d+\)\s*/, '').trim();

              const bodyText = document.body.innerText;
              const thaiUnits = { 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };

              // Member count patterns
              const memberPatterns = [
                [/สมาชิก\s*([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)/, true],
                [/([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)\s*(?:คน\s*)?สมาชิก/, true],
                [/สมาชิก\s*([\d,]+)\s*คน/, false],
                [/สมาชิก\s*([\d,]+)/, false],
                [/([\d,]+)\s*สมาชิก/, false],
                [/([\d.]+)\s*[Kk]\s*members/i, 'K'],
                [/([\d.]+)\s*[Mm]\s*members/i, 'M'],
                [/([\d,]+)\s*members/i, false],
              ];
              for (const [pat, unit] of memberPatterns) {
                const m = bodyText.match(pat);
                if (m && !memberCount) {
                  if (unit === true) {
                    memberCount = Math.round(parseFloat(m[1].replace(',', '.')) * (thaiUnits[m[2]] || 1));
                  } else if (unit === 'K') {
                    memberCount = Math.round(parseFloat(m[1]) * 1000);
                  } else if (unit === 'M') {
                    memberCount = Math.round(parseFloat(m[1]) * 1000000);
                  } else {
                    memberCount = parseInt(m[1].replace(/,/g, ''));
                  }
                }
              }

              // Posts today / month (simplified)
              let postsToday, postsLastMonth;
              const parseCompact = (raw) => {
                if (!raw) return undefined;
                const s = String(raw).replace(/\u00A0/g, ' ').trim().replace(/\s+/g, '');
                const mm = s.match(/^([\d.,]+)([KkMm]|พัน|หมื่น|แสน|ล้าน)?$/);
                if (!mm) return undefined;
                let num = parseFloat(mm[1].replace(/,/g, ''));
                const mult = { k: 1000, K: 1000, m: 1000000, M: 1000000, 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };
                return Math.round(num * (mult[mm[2]] || 1));
              };
              // Check spans for adjacent number + label pattern
              const spans = document.querySelectorAll('span');
              const todayLabels = ['โพสต์ใหม่ในวันนี้', 'โพสต์ใหม่วันนี้', 'โพสต์วันนี้', 'new posts today', 'new post today'];
              const monthLabels = ['โพสต์ในเดือนที่ผ่านมา', 'โพสต์เมื่อเดือนที่แล้ว', 'โพสต์ต่อเดือน', 'โพสต์/เดือน', 'posts in the last month', 'posts last month', 'in the last month'];
              spans.forEach(span => {
                const t = (span.textContent?.trim() || '').toLowerCase();
                const findPrev = (el) => {
                  let p = el.previousElementSibling;
                  if (!p && el.parentElement) p = el.parentElement.previousElementSibling;
                  return p ? (p.textContent?.trim() || '') : '';
                };
                if (postsToday === undefined && todayLabels.some(l => t.includes(l.toLowerCase()))) {
                  const v = parseCompact(findPrev(span));
                  if (v !== undefined) postsToday = v;
                }
                if (postsLastMonth === undefined && monthLabels.some(l => t.includes(l.toLowerCase()))) {
                  const v = parseCompact(findPrev(span));
                  if (v !== undefined) postsLastMonth = v;
                }
              });
              // Regex fallback on bodyText
              if (postsToday === undefined) {
                const m = bodyText.match(/([\d.,]+\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)\s*โพสต์(?:ใหม่)?(?:ใน)?วันนี้/);
                if (m) postsToday = parseCompact(m[1]);
              }
              if (postsLastMonth === undefined) {
                const m = bodyText.match(/([\d.,]+\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)\s*(?:โพสต์)?(?:ใน)?เดือนที่ผ่านมา/);
                if (m) postsLastMonth = parseCompact(m[1]);
              }
              if (postsLastMonth === undefined) {
                const m = bodyText.match(/([\d.,]+\s*(?:[KkMm])?)\s*in the last month/i);
                if (m) postsLastMonth = parseCompact(m[1]);
              }

              return { name, memberCount, postsToday, postsLastMonth };
            });

            console.log(`📊 [BG-Update ${i + 1}/${groups.length}] ${info.name?.substring(0, 30)} | Members: ${info.memberCount} | Today: ${info.postsToday} | Month: ${info.postsLastMonth}`);

            // Build update payload — always patch last_updated so user sees the check ran
            const scrapedName = info.name || '';
            const newName = isValidName(scrapedName) ? scrapedName : group.name;
            const updates = {
              name: newName || group.name,
              member_count: info.memberCount || group.memberCount || 0,
              last_updated: new Date().toISOString(),
            };
            if (typeof info.postsToday === 'number') updates.posts_today = info.postsToday;
            if (typeof info.postsLastMonth === 'number') updates.posts_last_month = info.postsLastMonth;

            const patchRes = await fetch(`${supaUrl}/rest/v1/facebook_groups?id=eq.${group.id}&user_id=eq.${req.userId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify(updates),
            });
            if (!patchRes.ok) {
              console.warn(`⚠️ [BG-Update] Supabase PATCH failed for group ${group.id}: ${patchRes.status}`);
              job.failed++;
            } else {
              job.success++;
            }
          } catch (err) {
            console.warn(`⚠️ [BG-Update] Error on group ${group.name}: ${err.message}`);
            job.failed++;
          }

          // Delay between groups to avoid rate limiting
          if (i < groups.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        job.status = 'done';
        job.finishedAt = Date.now();
        console.log(`✅ [BG-Update] Completed for user ${req.userId.slice(0, 8)}: ${job.success} success, ${job.failed} failed`);

        // Auto-cleanup job after 10 minutes
        setTimeout(() => {
          const current = groupUpdateJobs.get(req.userId);
          if (current && current.jobId === jobId) {
            groupUpdateJobs.delete(req.userId);
          }
        }, 10 * 60 * 1000);

      } catch (err) {
        job.status = 'error';
        job.error = err.message;
        job.finishedAt = Date.now();
        console.error(`❌ [BG-Update] Fatal error: ${err.message}`);
      }
    })();

  } catch (error) {
    console.error('Update-all start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Poll background group update status
app.get('/api/groups/update-all/status', ...auth, (req, res) => {
  const job = groupUpdateJobs.get(req.userId);
  if (!job) {
    return res.json({ success: true, status: 'idle', message: 'No active update job' });
  }
  res.json({
    success: true,
    jobId: job.jobId,
    status: job.status,
    total: job.total,
    current: job.current,
    successCount: job.success,
    failedCount: job.failed,
    currentGroupName: job.currentGroupName,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
  });
});

// Cancel background group update
app.post('/api/groups/update-all/cancel', ...auth, (req, res) => {
  const job = groupUpdateJobs.get(req.userId);
  if (!job || job.status !== 'running') {
    return res.json({ success: true, message: 'No running job to cancel' });
  }
  job.status = 'cancelled';
  job.finishedAt = Date.now();
  res.json({ success: true, message: 'Job cancelled' });
});

// ====================================
// Group Posting Automation Endpoints
// ====================================

// Start group posting automation (with queue system for VPS stability)
// Captions are auto-generated on backend based on group count
app.post('/api/group-automation/start', ...auth, async (req, res) => {
  try {
    const { property, groups, images, delayMinutes, delaySeconds, claudeApiKey, browser, userPackage, fbSlot } = req.body;

    // Switch to the correct FB session slot if specified
    if (typeof fbSlot === 'number' && fbSlot >= 0) {
      req.groupWorker.setProfileSlot(fbSlot);
      sessionManager.setActiveSlot(req.userId, fbSlot);
      console.log(`🔗 [Automation] Using FB session slot ${fbSlot}`);
    }

    if (!property) {
      return res.status(400).json({ success: false, error: 'Property is required' });
    }
    if (!groups || groups.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one group is required' });
    }

    // Validate post limit based on package
    const packageLimits = { free: 10, agent: 300, elite: 750 };
    const limit = packageLimits[userPackage] || 10;
    if (groups.length > limit) {
      return res.status(400).json({
        success: false,
        error: `Package ${userPackage} limit exceeded`,
        message: `แพ็กเกจ ${userPackage.toUpperCase()} จำกัด ${limit} โพสต์/วัน คุณเลือก ${groups.length} กลุ่ม`
      });
    }

    // Initialize Claude API if key provided
    if (claudeApiKey) {
      req.groupWorker.initAnthropicClient(claudeApiKey);
    }

    // Auto-generate captions based on group count (this happens BEFORE queue)
    const groupCount = groups.length;
    let requiredCaptions;
    if (groupCount <= 10) requiredCaptions = 1;
    else if (groupCount <= 20) requiredCaptions = 2;
    else if (groupCount <= 50) requiredCaptions = 3;
    else requiredCaptions = 5;

    console.log(`📝 Auto-generating ${requiredCaptions} caption(s) for ${groupCount} groups...`);

    const generatedCaptions = [];
    const captionStyle = 'friendly';
    for (let i = 0; i < requiredCaptions; i++) {
      try {
        const cap = await req.groupWorker.generateCaption(property, captionStyle, userPackage || 'free');
        generatedCaptions.push(cap);
      } catch (err) {
        console.error(`Caption gen ${i + 1} failed:`, err.message);
      }
    }

    // Fallback: if no captions generated, use property description
    if (generatedCaptions.length === 0) {
      generatedCaptions.push(property.description || property.title || 'Property listing');
    }

    console.log(`✅ Generated ${generatedCaptions.length} caption(s)`);

    // Assign captions to groups randomly
    const captionAssignments = {};
    groups.forEach(g => {
      const idx = Math.floor(Math.random() * generatedCaptions.length);
      captionAssignments[g.id] = generatedCaptions[idx];
    });

    const automationConfig = {
      property,
      groups,
      caption: generatedCaptions[0],
      captions: generatedCaptions,
      captionAssignments,
      images: images || property.images || [],
      delayMinutes: delayMinutes || undefined,
      delaySeconds: delaySeconds || undefined,
      captionStyle,
      browser: browser || 'chrome',
      userPackage: userPackage || 'free',
    };

    // Use queue system — either starts immediately or enqueues
    const groupWorker = req.groupWorker;
    const session = sessionManager.getSession(req.userId);
    const displayName = session?.displayName || session?.email?.split('@')[0] || req.userId.substring(0, 8);
    const activeSlot = session?.activeSlot || 0;
    const fbSession = session?.fbSessions?.[activeSlot];
    const fbAccount = fbSession?.name || null;

    const queueResult = await automationQueue.tryStartOrEnqueue(
      req.userId,
      (cfg) => groupWorker.startAutomation(cfg),
      automationConfig,
      { worker: groupWorker, displayName, email: session?.email || null, fbAccount, propertyTitle: property?.title || null, automationType: 'group' }
    );

    if (queueResult.queued) {
      // User is in the queue — not started yet
      console.log(`📋 User ${req.userId.substring(0, 8)} queued at position ${queueResult.position}`);
      return res.json({
        success: true,
        queued: true,
        position: queueResult.position,
        estimatedWaitSec: queueResult.estimatedWaitSec,
        message: `คิวที่ ${queueResult.position} — รอประมาณ ${Math.ceil(queueResult.estimatedWaitSec / 60)} นาที`,
        totalGroups: groups.length,
        generatedCaptions,
      });
    }

    // Started immediately — return status
    // Small delay so worker initializes tasks
    await new Promise(r => setTimeout(r, 200));
    const status = groupWorker.getStatus();

    res.json({
      success: true,
      queued: false,
      message: `เริ่ม automation แล้ว — ${groups.length} กลุ่ม`,
      totalGroups: groups.length,
      generatedCaptions,
      isRunning: status.isRunning,
      isPaused: status.isPaused,
      currentStep: status.currentStep,
      totalSteps: status.totalSteps,
      tasks: status.tasks,
      logs: status.logs,
      startTime: status.startTime,
      endTime: status.endTime,
    });
  } catch (error) {
    console.error('Group automation start error:', error);
    // Return 409 for "already running" instead of 500
    const isAlreadyRunning = error.message?.includes('Automation') && error.message?.includes('กำลังทำงาน');
    const statusCode = isAlreadyRunning ? 409 : 500;
    res.status(statusCode).json({ success: false, error: error.message, errorType: isAlreadyRunning ? 'already_running' : 'server_error' });
  }
});

// Get automation status (includes queue info)
app.get('/api/group-automation/status', ...auth, (req, res) => {
  try {
    const status = req.groupWorker.getStatus();
    const queueStatus = automationQueue.getUserQueueStatus(req.userId);
    res.json({ success: true, ...status, queue: queueStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Queue status for this user (includes capacity + running jobs for queue display)
app.get('/api/group-automation/queue-status', ...auth, (req, res) => {
  try {
    const queueStatus = automationQueue.getUserQueueStatus(req.userId);
    const workerStatus = req.groupWorker.getStatus();
    res.json({
      success: true,
      ...queueStatus,
      isRunning: workerStatus.isRunning,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel queue position (before automation starts)
app.post('/api/group-automation/cancel-queue', ...auth, (req, res) => {
  try {
    const removed = automationQueue.cancelQueue(req.userId);
    res.json({ success: true, removed, message: removed ? 'ออกจากคิวแล้ว' : 'ไม่ได้อยู่ในคิว' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: full queue stats
app.get('/api/admin/queue', ...adminAuth, (req, res) => {
  try {
    res.json({ success: true, ...automationQueue.getQueueStats() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: force-stop a specific user's automation
app.post('/api/admin/force-stop', ...adminAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required' });
    }

    const targetSession = sessionManager.sessions.get(targetUserId);
    if (!targetSession) {
      return res.status(404).json({ success: false, error: 'User session not found' });
    }

    const results = [];

    // Cancel from queue if waiting
    const wasQueued = automationQueue.cancelQueue(targetUserId);
    if (wasQueued) results.push('Removed from queue');

    // Stop group automation
    if (targetSession.groupWorker.isRunning) {
      try {
        await targetSession.groupWorker.stop();
        results.push('Group automation stopped');
      } catch (e) {
        results.push(`Group stop error: ${e.message}`);
      }
    }

    // Stop marketplace automation
    if (targetSession.marketplaceWorker.isRunning) {
      try {
        await targetSession.marketplaceWorker.stop();
        results.push('Marketplace automation stopped');
      } catch (e) {
        results.push(`Marketplace stop error: ${e.message}`);
      }
    }

    // Notify queue system (frees slot for next in queue)
    if (!wasQueued) {
      automationQueue._onJobComplete(targetUserId, false);
    }

    const shortId = targetUserId.substring(0, 8);
    console.log(`🛑 [Admin] Force-stopped user ${shortId}: ${results.join(', ') || 'No running automation'}`);

    res.json({
      success: true,
      message: results.length > 0 ? results.join('; ') : 'No active automation to stop',
      results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: get ALL registered users from Supabase Auth + merge with live session data
app.get('/api/admin/all-users', ...adminAuth, async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Fetch all users from Supabase Auth (paginated, up to 1000)
    const { data: { users }, error } = await supa.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    // Fetch display_ids from public.users table
    const displayIdMap = new Map();
    try {
      const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?select=id,display_id`, {
        headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
      });
      if (resp.ok) {
        const rows = await resp.json();
        for (const r of rows) { if (r.display_id) displayIdMap.set(r.id, r.display_id); }
      }
    } catch (e) { console.log('⚠️ Could not fetch display_ids:', e.message); }

    // Get live session stats
    const adminStats = sessionManager.getAdminStats();
    const liveUserMap = new Map();
    for (const u of adminStats.users) {
      if (u.fullUserId) liveUserMap.set(u.fullUserId, u);
    }

    // Merge: all Supabase users + live session overlay + display_id
    const merged = (users || []).map(u => {
      const live = liveUserMap.get(u.id);
      const meta = u.user_metadata || {};
      return {
        userId: u.id.substring(0, 8) + '...',
        fullUserId: u.id,
        displayId: displayIdMap.get(u.id) || null,
        email: u.email || null,
        displayName: meta.display_name || meta.full_name || (u.email ? u.email.split('@')[0] : u.id.substring(0, 8)),
        fullName: meta.full_name || null,
        lineId: meta.line_id || null,
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at,
        banned: !!u.banned_until || !!meta.banned,
        // Live session data (if user is online / has session)
        isOnline: live?.isOnline || false,
        isRunningGroup: live?.isRunningGroup || false,
        isRunningMarketplace: live?.isRunningMarketplace || false,
        hasBrowser: live?.hasBrowser || false,
        todayPosts: live?.todayPosts || 0,
        todaySuccess: live?.todaySuccess || 0,
        todayFailed: live?.todayFailed || 0,
        automationRuns: live?.automationRuns || 0,
        currentTasks: live?.currentTasks || { total: 0, completed: 0, failed: 0, pending: 0 },
        lastActivity: live?.lastActivity || null,
      };
    });

    res.json({ success: true, users: merged, totalUsers: merged.length });
  } catch (error) {
    console.error('Admin all-users error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: get license activation details (which user activated which key)
app.get('/api/admin/license-activations', ...adminAuth, async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);

    const { data, error } = await supa
      .from('device_activations')
      .select('*, license_keys(license_key, package, owner_name)')
      .order('activated_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, activations: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: ban/unban a user
app.post('/api/admin/ban-user', ...adminAuth, async (req, res) => {
  try {
    const { targetUserId, banned } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });

    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Update user metadata with banned flag
    const { error } = await supa.auth.admin.updateUserById(targetUserId, {
      user_metadata: { banned: !!banned },
      ...(banned ? { ban_duration: '876000h' } : { ban_duration: 'none' }),
    });
    if (error) throw error;

    // If banning, also force-stop their automation
    if (banned) {
      const session = sessionManager.getSession(targetUserId);
      if (session?.groupWorker?.isRunning) {
        await session.groupWorker.stop();
        automationQueue._onJobComplete(targetUserId, false);
      }
      if (session?.marketplaceWorker?.isRunning) {
        await session.marketplaceWorker.stop();
      }
    }

    const shortId = targetUserId.substring(0, 8);
    console.log(`${banned ? '🚫' : '✅'} [Admin] User ${shortId} ${banned ? 'BANNED' : 'UNBANNED'}`);
    res.json({ success: true, banned: !!banned, message: `User ${shortId} ${banned ? 'banned' : 'unbanned'}` });
  } catch (error) {
    console.error('Ban user error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: delete user and all their data
app.post('/api/admin/delete-user', ...adminAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_KEY not configured — ตั้งค่าใน backend/.env ก่อน' });
    }

    const supaUrl = process.env.SUPABASE_URL;
    const shortId = targetUserId.substring(0, 8);
    console.log(`🗑️ [Admin] Starting delete for user ${shortId}...`);

    // 1. Force-stop any running automation
    const session = sessionManager.getSession(targetUserId);
    if (session?.groupWorker?.isRunning) {
      await session.groupWorker.stop();
      automationQueue._onJobComplete(targetUserId, false);
    }
    if (session?.marketplaceWorker?.isRunning) {
      await session.marketplaceWorker.stop();
    }

    // 2. Delete from public tables using direct PostgREST (avoids Supabase client .select() bug)
    const tables = ['facebook_groups', 'properties', 'license_keys'];
    const deleted = {};
    for (const table of tables) {
      try {
        const resp = await fetch(`${supaUrl}/rest/v1/${table}?user_id=eq.${targetUserId}`, {
          method: 'DELETE',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
        });
        if (resp.ok) {
          const rows = await resp.json();
          deleted[table] = Array.isArray(rows) ? rows.length : 0;
        } else {
          const errText = await resp.text();
          console.log(`   ⚠️ Delete ${table}: ${resp.status} ${errText}`);
          deleted[table] = 0;
        }
      } catch (e) {
        console.log(`   ⚠️ Delete ${table}: ${e.message}`);
        deleted[table] = 0;
      }
    }

    // 3. Delete from public.users
    try {
      await fetch(`${supaUrl}/rest/v1/users?id=eq.${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      console.log(`   ⚠️ Delete users table: ${e.message}`);
    }

    // 4. Delete auth user (this also cascades via FK)
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(supaUrl, serviceKey);
    const { error: authErr } = await supa.auth.admin.deleteUser(targetUserId);
    if (authErr) {
      // If user already doesn't exist in auth, that's fine
      if (authErr.message?.includes('not found') || authErr.message?.includes('User not found')) {
        console.log(`   ℹ️ Auth user already deleted or not found`);
      } else {
        throw authErr;
      }
    }

    // 5. Clean up in-memory session
    sessionManager.destroySession?.(targetUserId);

    console.log(`🗑️ [Admin] User ${shortId} DELETED — groups:${deleted.facebook_groups}, properties:${deleted.properties}, licenses:${deleted.license_keys}`);
    res.json({
      success: true,
      message: `ลบผู้ใช้ ${shortId} สำเร็จ — กลุ่ม:${deleted.facebook_groups}, ทรัพย์สิน:${deleted.properties}`,
      deleted,
    });
  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: change user package (update or create license)
app.post('/api/admin/change-package', ...adminAuth, async (req, res) => {
  try {
    const { targetUserId, newPackage } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });
    if (!['free', 'agent', 'elite'].includes(newPackage)) return res.status(400).json({ success: false, error: 'Invalid package' });

    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    if (newPackage === 'free') {
      // Downgrade to free: deactivate any bound license
      const { error } = await supa
        .from('license_keys')
        .update({ is_active: false })
        .eq('bound_user_id', targetUserId);
      if (error) throw error;
      res.json({ success: true, package: 'free', message: 'Downgraded to Free (license deactivated)' });
    } else {
      // Check if user already has a bound license
      const { data: existing } = await supa
        .from('license_keys')
        .select('*')
        .eq('bound_user_id', targetUserId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update existing license package
        const { error } = await supa
          .from('license_keys')
          .update({ package: newPackage })
          .eq('id', existing.id);
        if (error) throw error;
        res.json({ success: true, package: newPackage, message: `Updated license to ${newPackage}` });
      } else {
        // Create admin-assigned license for this user
        const key = `GSADM-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const expiresAt = new Date();
        const durationDays = req.body.durationDays || 365;
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        // Resolve user's display name
        let ownerName = req.body.displayName || null;
        if (!ownerName) {
          try {
            const { data: authUser } = await supa.auth.admin.getUserById(targetUserId);
            ownerName = authUser?.user?.user_metadata?.display_name || authUser?.user?.user_metadata?.full_name || authUser?.user?.email?.split('@')[0] || null;
          } catch { /* fallback */ }
        }

        const { error } = await supa
          .from('license_keys')
          .insert({
            license_key: key,
            package: newPackage,
            max_devices: 1,
            expires_at: expiresAt.toISOString(),
            is_active: true,
            bound_user_id: targetUserId,
            owner_name: ownerName || `User ${targetUserId.substring(0, 8)}`,
            note: `Admin-assigned ${newPackage} package (${durationDays}d)`,
          });
        if (error) throw error;
        res.json({ success: true, package: newPackage, licenseKey: key, message: `Created ${newPackage} license` });
      }
    }
  } catch (error) {
    console.error('Change package error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: delete a license key (uses service key to bypass RLS)
app.post('/api/admin/delete-license', ...adminAuth, async (req, res) => {
  try {
    const { licenseId } = req.body;
    if (!licenseId) return res.status(400).json({ success: false, error: 'licenseId required' });

    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Delete related device activations first
    await supa.from('device_activations').delete().eq('license_key_id', licenseId);

    // Delete the license key
    const { data, error } = await supa
      .from('license_keys')
      .delete()
      .eq('id', licenseId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    console.log(`🗑️ [Admin] License ${licenseId} deleted by ${req.userEmail}`);
    res.json({ success: true, deleted: data[0] });
  } catch (error) {
    console.error('Delete license error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: get license info for all users
app.get('/api/admin/user-licenses', ...adminAuth, async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supa
      .from('license_keys')
      .select('bound_user_id, license_key, package, expires_at, is_active, owner_name, created_at')
      .not('bound_user_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by user ID — latest active license per user
    const byUser = {};
    for (const row of (data || [])) {
      const uid = row.bound_user_id;
      if (!byUser[uid] || (row.is_active && !byUser[uid].is_active)) {
        byUser[uid] = row;
      }
    }

    res.json({ success: true, licenses: byUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: clear job history (all / success / failed)
app.post('/api/admin/clear-history', ...adminAuth, (req, res) => {
  try {
    const { type = 'all' } = req.body; // 'all' | 'success' | 'failed'
    if (!['all', 'success', 'failed'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be all | success | failed' });
    }
    const removed = automationQueue.clearHistory(type);
    console.log(`🗑️ Admin cleared ${removed} history records (type=${type})`);
    res.json({ success: true, removed, message: `ลบประวัติ ${removed} รายการ (${type})` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: export job history as JSON (for CSV download on frontend)
app.get('/api/admin/export-history', ...adminAuth, (req, res) => {
  try {
    const stats = automationQueue.getQueueStats();
    const allHistory = stats.recentHistory || [];
    res.json({ success: true, history: allHistory, exportedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: manually trigger ghost/stale session cleanup
app.post('/api/admin/clear-stale-sessions', ...adminAuth, (req, res) => {
  try {
    const before = automationQueue.running.size;
    automationQueue._cleanupStaleEntries();
    const after = automationQueue.running.size;
    const cleared = before - after;
    const queueBefore = automationQueue.queue.length;
    // queue entries already cleaned inside _cleanupStaleEntries
    const queueCleared = queueBefore - automationQueue.queue.length;
    res.json({ success: true, message: `ล้าง ghost sessions ${cleared} รายการ, queue ${queueCleared} รายการ`, cleared, queueCleared });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause automation
app.post('/api/group-automation/pause', ...auth, (req, res) => {
  try {
    req.groupWorker.pause();
    res.json({ success: true, message: 'Automation paused' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume automation
app.post('/api/group-automation/resume', ...auth, (req, res) => {
  try {
    req.groupWorker.resume();
    res.json({ success: true, message: 'Automation resumed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop automation (also removes from queue + notifies queue system)
app.post('/api/group-automation/stop', ...auth, async (req, res) => {
  try {
    // Remove from queue if waiting (before it started)
    const wasQueued = automationQueue.cancelQueue(req.userId);
    // Track if browser was open before stop
    const hadBrowser = !!(req.groupWorker.browser && req.groupWorker.browser.isConnected());
    // Stop the worker (closes browser internally)
    await req.groupWorker.stop();
    // Decrement browser counter if browser was closed
    if (hadBrowser) sessionManager.registerBrowserClose();
    // Only notify queue if user was actually running (not just queued)
    // _onJobComplete has a guard but being explicit avoids unnecessary log noise
    if (!wasQueued) {
      automationQueue._onJobComplete(req.userId, false);
    }
    res.json({ success: true, message: 'Automation stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close browser
app.post('/api/group-automation/close', ...auth, async (req, res) => {
  try {
    const hadBrowser = !!(req.groupWorker.browser && req.groupWorker.browser.isConnected());
    await req.groupWorker.close();
    if (hadBrowser) sessionManager.registerBrowserClose();
    res.json({ success: true, message: 'Browser closed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize browser (for pre-login)
app.post('/api/group-automation/init', ...auth, async (req, res) => {
  try {
    await req.groupWorker.initialize();
    res.json({ success: true, message: 'Browser initialized - Please login to Facebook' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check login status
app.get('/api/group-automation/check-login', ...auth, async (req, res) => {
  try {
    if (!req.groupWorker.browser) {
      await req.groupWorker.initialize();
    }
    const isLoggedIn = await req.groupWorker.checkLogin();
    res.json({ success: true, isLoggedIn });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate caption using Claude API
// Supports package-based prompts and required caption count
app.post('/api/group-automation/generate-caption', ...auth, async (req, res) => {
  try {
    const { property, style, claudeApiKey, userPackage = 'free', requiredCaptions = 1 } = req.body;

    if (claudeApiKey) {
      req.groupWorker.initAnthropicClient(claudeApiKey);
    }

    console.log(`📝 Generate caption request - Package: ${userPackage}, Required: ${requiredCaptions}`);

    // Generate multiple captions based on required count
    const allCaptions = [];

    for (let i = 0; i < requiredCaptions; i++) {
      const caption = await req.groupWorker.generateCaption(property, style || 'friendly', userPackage);
      allCaptions.push(caption);
    }

    // allCaptions is already an array of individual captions — use directly
    const fullResponse = allCaptions.join('\n\n---\n\n');

    res.json({
      success: true,
      caption: fullResponse,           // Full response (joined)
      captions: allCaptions,           // Array of individual captions
      package: userPackage,
      captionCount: allCaptions.length,
      requiredCaptions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// Facebook Connection Endpoints (Multi-Session)
// ====================================

// Helper: scrape FB user info from current page
// Uses page.title() as primary strategy (most reliable), then /me/ fallback
async function scrapeFbUserInfo(page) {
  const BLACKLIST = ['facebook', 'log in', 'log into', 'sign up', 'เข้าสู่ระบบ', 'สมัครสมาชิก', 'messenger', 'watch', 'marketplace'];
  const isValidName = (n) => {
    if (!n || n.length < 2 || n.length > 60) return false;
    const lower = n.toLowerCase().trim();
    return !BLACKLIST.some(b => lower === b);
  };

  let name = '';
  let profilePic = '';

  try {
    // ── Step 1: Check if page is a login page → skip entirely ──
    const pageUrl = page.url();
    const pageTitle = await page.title().catch(() => '');
    console.log(`🔍 [scrapeFbUserInfo] URL: ${pageUrl} | Title: "${pageTitle}"`);

    const isLoginPage = await page.evaluate(() => {
      return !!(document.querySelector('input[name="email"]') || 
               document.querySelector('input[name="pass"]') || 
               document.querySelector('#email') || 
               document.querySelector('#pass'));
    }).catch(() => false);

    if (isLoginPage) {
      console.log('⚠️ scrapeFbUserInfo: Login page detected — returning empty');
      return { name: '', profilePic: '' };
    }

    // ── Step 2: Extract name from page title ──
    // Facebook titles: "(1) Name | Facebook", "Name | Facebook", "Name - Facebook"
    if (pageTitle) {
      const cleaned = pageTitle.replace(/^\(\d+\)\s*/, '');
      let candidate = '';
      if (cleaned.includes(' | ')) candidate = cleaned.split(' | ')[0].trim();
      else if (cleaned.includes(' - ')) candidate = cleaned.split(' - ')[0].trim();
      if (isValidName(candidate)) {
        name = candidate;
        console.log(`✅ [scrapeFbUserInfo] Got name from page title: "${name}"`);
      }
    }

    // ── Step 3: Extract profile pic from current page ──
    profilePic = await page.evaluate(() => {
      // SVG image elements (FB uses these for avatars)
      const svgImgs = document.querySelectorAll('image');
      for (const img of svgImgs) {
        const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
        if (href.includes('scontent')) return href;
      }
      // Regular img elements with scontent
      const imgs = document.querySelectorAll('img[src*="scontent"]');
      for (const img of imgs) {
        const src = img.getAttribute('src') || '';
        if (src.includes('scontent')) return src;
      }
      return '';
    }).catch(() => '');

    // ── Step 4: If no name yet, navigate to /me/ profile page ──
    if (!name) {
      console.log('🔍 [scrapeFbUserInfo] No name from current page, trying /me/...');
      try {
        await page.goto('https://www.facebook.com/me/', { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 4000));

        const meUrl = page.url();
        const meTitle = await page.title().catch(() => '');
        console.log(`🔍 [/me/] URL: ${meUrl} | Title: "${meTitle}"`);

        // Check if /me/ also shows login page
        const meIsLogin = await page.evaluate(() => {
          return !!(document.querySelector('input[name="email"]') || document.querySelector('input[name="pass"]'));
        }).catch(() => false);

        if (meIsLogin) {
          console.log('⚠️ [/me/] Still on login page — not logged in');
          return { name: '', profilePic: '' };
        }

        // Try name from /me/ page title
        if (meTitle) {
          const cleaned = meTitle.replace(/^\(\d+\)\s*/, '');
          let candidate = '';
          if (cleaned.includes(' | ')) candidate = cleaned.split(' | ')[0].trim();
          else if (cleaned.includes(' - ')) candidate = cleaned.split(' - ')[0].trim();
          if (isValidName(candidate)) {
            name = candidate;
            console.log(`✅ [/me/] Got name from title: "${name}"`);
          }
        }

        // Try h1 element on profile page
        if (!name) {
          const h1Text = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            return h1?.textContent?.trim() || '';
          }).catch(() => '');
          if (isValidName(h1Text)) {
            name = h1Text;
            console.log(`✅ [/me/] Got name from h1: "${name}"`);
          }
        }

        // Try og:title meta
        if (!name) {
          const ogName = await page.evaluate(() => {
            const og = document.querySelector('meta[property="og:title"]');
            return og?.getAttribute('content')?.trim() || '';
          }).catch(() => '');
          if (isValidName(ogName)) {
            name = ogName;
            console.log(`✅ [/me/] Got name from og:title: "${name}"`);
          }
        }

        // Get profile pic from /me/ if not already found
        if (!profilePic) {
          profilePic = await page.evaluate(() => {
            const svgImgs = document.querySelectorAll('image');
            for (const img of svgImgs) {
              const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
              if (href.includes('scontent')) return href;
            }
            const imgs = document.querySelectorAll('img[src*="scontent"]');
            for (const img of imgs) {
              const src = img.getAttribute('src') || '';
              if (src.includes('scontent')) return src;
            }
            return '';
          }).catch(() => '');
        }
      } catch (e) {
        console.log('⚠️ [/me/] Navigation error:', e.message);
      }
    }
  } catch (e) {
    console.log('⚠️ scrapeFbUserInfo error:', e.message);
  }

  console.log(`👤 [FB Profile] Name: "${name}" | Pic: ${profilePic ? 'YES' : 'NO'}`);
  return { name, profilePic };
}

// Connect to Facebook — slot-aware (opens browser for a specific session slot)
app.post('/api/facebook/connect', ...auth, async (req, res) => {
  try {
    const slot = parseInt(req.body.slot) || 0;
    console.log(`🔗 [FB] Connect request for slot ${slot} (user ${req.userId.substring(0, 8)})`);

    // Close existing browser before switching slot
    if (req.groupWorker.browser) {
      try { await req.groupWorker.close(); } catch (e) { }
      sessionManager.registerBrowserClose();
    }

    // Switch worker to the target slot's profile directory
    req.groupWorker.setProfileSlot(slot);
    sessionManager.setActiveSlot(req.userId, slot);

    // Initialize browser with retry
    let retries = 2;
    let lastError = null;
    while (retries > 0) {
      try {
        await req.groupWorker.initialize('chrome');
        break;
      } catch (initErr) {
        lastError = initErr;
        retries--;
        console.error(`Browser init failed (${retries} retries left):`, initErr.message);
        try { if (req.groupWorker.browser) await req.groupWorker.browser.close(); } catch (e) { }
        req.groupWorker.browser = null;
        req.groupWorker.page = null;
        if (retries > 0) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!req.groupWorker.browser || !req.groupWorker.page) {
      throw lastError || new Error('Browser initialization failed');
    }

    sessionManager.registerBrowserStart();

    await req.groupWorker.page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Auto-click "ดำเนินการต่อ" (Continue as) button if Facebook shows profile chooser
    try {
      const clicked = await req.groupWorker.page.evaluate(() => {
        // Look for "ดำเนินการต่อ" or "Continue" or "Log In" button
        const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === 'ดำเนินการต่อ' || text === 'Continue' || text === 'Log Into' || text === 'เข้าสู่ระบบ') {
            btn.click();
            return text;
          }
        }
        return null;
      });
      if (clicked) {
        console.log(`🔗 [FB] Auto-clicked "${clicked}" on profile chooser`);
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) { /* non-critical */ }

    res.json({ success: true, message: 'Browser opened - Please login to Facebook', status: 'pending_login', slot });
  } catch (error) {
    console.error('Facebook connect error:', error.message);
    try { if (req.groupWorker.browser) await req.groupWorker.browser.close(); } catch (e) { }
    req.groupWorker.browser = null;
    req.groupWorker.page = null;
    res.status(500).json({ success: false, error: `เชื่อมต่อไม่ได้: ${error.message}` });
  }
});

// Auto-login to Facebook (for VPS headless mode)
app.post('/api/facebook/auto-login', ...auth, async (req, res) => {
  // Global 90s timeout guard — prevents infinite hang if any Puppeteer step hangs
  const _loginTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.warn(`⏱️ [auto-login] Timed out after 90s — forcing error response`);
      res.json({ success: false, error: 'Login หมดเวลา (90s) — กรุณาลองใหม่อีกครั้ง' });
    }
  }, 90000);
  res.on('finish', () => clearTimeout(_loginTimeout));

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ success: false, error: 'กรุณากรอก Email และ Password' });
    }
    if (!req.groupWorker.browser || !req.groupWorker.page) {
      return res.json({ success: false, error: 'Browser ยังไม่เปิด กรุณากด "เชื่อมต่อ" ก่อน' });
    }

    const page = req.groupWorker.page;
    const shortId = req.userId.substring(0, 8);

    // ── Step 1: Navigate to facebook.com ──
    console.log(`🔑 [${shortId}] Auto-login: navigating to facebook.com...`);
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const initialTitle = await page.title().catch(() => '');
    console.log(`🔑 [${shortId}] Page title: "${initialTitle}" | URL: ${page.url()}`);

    // ── Step 1.5: Handle "Continue as" profile chooser page ──
    // 3 cases: (A) Same account → "ดำเนินการต่อ", (B) Different account → "ใช้โปรไฟล์อื่น", (C) No chooser → skip
    try {
      const activeSlotForCreds = sessionManager.getActiveSlot(req.userId);
      const hasProfileChooser = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === 'ดำเนินการต่อ' || text === 'Continue') return true;
        }
        return false;
      }).catch(() => false);

      if (hasProfileChooser) {
        // Compare provided email with stored credentials to decide which button
        const storedCreds = sessionManager.loadFbCredentials(req.userId, activeSlotForCreds);
        const isSameAccount = storedCreds && storedCreds.email && storedCreds.email.toLowerCase().trim() === email.toLowerCase().trim();

        if (isSameAccount) {
          // Case A: Same account → click "ดำเนินการต่อ"
          console.log(`🔑 [${shortId}] Profile chooser: same account → clicking "ดำเนินการต่อ"`);
          await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
            for (const btn of btns) {
              const text = (btn.textContent || '').trim();
              if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return; }
            }
          });
          await new Promise(r => setTimeout(r, 5000));
        } else {
          // Case B: Different account → click "ใช้โปรไฟล์อื่น" to get login form
          console.log(`🔑 [${shortId}] Profile chooser: different account → clicking "ใช้โปรไฟล์อื่น"`);
          const clickedOther = await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
            for (const btn of btns) {
              const text = (btn.textContent || '').trim();
              if (text === 'ใช้โปรไฟล์อื่น' || text === 'Use other account' || text === 'Not you?' || text === 'Log Into Another Account') {
                btn.click();
                return text;
              }
            }
            return null;
          });
          if (clickedOther) {
            console.log(`🔑 [${shortId}] Clicked "${clickedOther}" — waiting for login form...`);
            await new Promise(r => setTimeout(r, 4000));
          } else {
            // Fallback: if "ใช้โปรไฟล์อื่น" not found, try clicking "ดำเนินการต่อ" anyway
            console.log(`🔑 [${shortId}] "ใช้โปรไฟล์อื่น" not found — falling back to "ดำเนินการต่อ"`);
            await page.evaluate(() => {
              const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
              for (const btn of btns) {
                const text = (btn.textContent || '').trim();
                if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return; }
              }
            });
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }
    } catch (e) { console.log(`⚠️ [${shortId}] Profile chooser handling error:`, e.message); }

    // ── Step 2: Check if already logged in ──
    const alreadyLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="email"]') &&
             !document.querySelector('input[name="pass"]') &&
             !document.querySelector('#email') &&
             !document.querySelector('#pass');
    }).catch(() => false);

    if (alreadyLoggedIn) {
      console.log(`🔑 [${shortId}] Already logged in! Scraping user info...`);
      const activeSlot = sessionManager.getActiveSlot(req.userId);
      const userInfo = await scrapeFbUserInfo(page);
      const fbName = userInfo.name || 'Facebook User';
      const fbPic = userInfo.profilePic || '';
      sessionManager.setFbSession(req.userId, activeSlot, { name: fbName, profilePic: fbPic });
      sessionManager.saveFbCredentials(req.userId, activeSlot, email, password);
      console.log(`✅ [${shortId}] Already logged in — saved session: "${fbName}" (slot ${activeSlot})`);
      return res.json({ success: true, message: `Login สำเร็จ! ${fbName}`, slot: activeSlot, user: { name: fbName, profilePic: fbPic } });
    }

    // ── Step 3: Handle cookie consent dialogs ──
    try {
      const cookieSelectors = [
        'button[data-cookiebanner="accept_button"]',
        'button[title="Allow all cookies"]',
        'button[title="อนุญาตคุกกี้ทั้งหมด"]',
        'button[value="1"][name="accept"]',
        '[data-testid="cookie-policy-manage-dialog-accept-button"]',
      ];
      for (const sel of cookieSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          console.log(`🍪 [${shortId}] Clicked cookie consent: ${sel}`);
          await btn.click().catch(() => { });
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      }
    } catch (e) { }

    // ── Step 4: Find and fill email ──
    const emailSelectors = ['#email', 'input[name="email"]', '#m_login_email', 'input[type="email"]'];
    let emailInput = null;
    for (const sel of emailSelectors) {
      try {
        emailInput = await page.waitForSelector(sel, { timeout: 5000, visible: true });
        if (emailInput) {
          console.log(`🔑 [${shortId}] Found email input: ${sel}`);
          break;
        }
      } catch (e) { }
    }
    if (!emailInput) {
      await new Promise(r => setTimeout(r, 3000));
      for (const sel of emailSelectors) { emailInput = await page.$(sel); if (emailInput) break; }
    }
    if (!emailInput) {
      console.log(`❌ [${shortId}] No email input found`);
      return res.json({ success: false, error: 'ไม่พบช่องกรอก Email — Facebook อาจ block หน้า Login' });
    }

    // Clear existing text and type email
    await emailInput.click({ clickCount: 3 }).catch(() => { });
    await new Promise(r => setTimeout(r, 200));
    await page.keyboard.press('Backspace').catch(() => { });
    await new Promise(r => setTimeout(r, 200));
    await emailInput.type(email, { delay: 80 });
    console.log(`🔑 [${shortId}] Typed email: ${email.substring(0, 4)}***`);
    await new Promise(r => setTimeout(r, 500));

    // ── Step 5: Find and fill password ──
    const passSelectors = ['#pass', 'input[name="pass"]', '#m_login_password', 'input[type="password"]'];
    let passInput = null;
    for (const sel of passSelectors) { passInput = await page.$(sel); if (passInput) break; }
    if (!passInput) {
      console.log(`❌ [${shortId}] No password input found`);
      return res.json({ success: false, error: 'ไม่พบช่องกรอก Password' });
    }
    await passInput.click({ clickCount: 3 }).catch(() => { });
    await new Promise(r => setTimeout(r, 200));
    await page.keyboard.press('Backspace').catch(() => { });
    await new Promise(r => setTimeout(r, 200));
    await passInput.type(password, { delay: 80 });
    console.log(`🔑 [${shortId}] Typed password (${password.length} chars)`);
    await new Promise(r => setTimeout(r, 500));

    // ── Step 6: Click login button ──
    const btnSelectors = [
      'button[name="login"]',
      '#loginbutton',
      'button[type="submit"]',
      'input[name="login"]',
      'button[data-testid="royal_login_button"]',
    ];
    let clicked = false;
    for (const sel of btnSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await page.evaluate(el => el.click(), btn);
          clicked = true;
          console.log(`🔑 [${shortId}] Clicked login button: ${sel}`);
          break;
        }
      } catch (e) { }
    }
    if (!clicked) {
      // Fallback: press Enter on password field
      try { await passInput.press('Enter'); clicked = true; console.log(`🔑 [${shortId}] Pressed Enter on password field`); } catch (e) { }
    }
    if (!clicked) {
      console.log(`❌ [${shortId}] Could not click login button`);
      return res.json({ success: false, error: 'ไม่สามารถกดปุ่ม Login ได้' });
    }

    // ── Step 7: Wait for navigation after login ──
    console.log(`🔑 [${shortId}] Waiting for login response...`);
    // Use Promise.race: wait for navigation OR timeout (domcontentloaded — networkidle2 hangs on Facebook)
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      new Promise(r => setTimeout(r, 12000)),
    ]);

    const postLoginUrl = page.url();
    const postLoginTitle = await page.title().catch(() => '');
    console.log(`🔑 [${shortId}] Post-login URL: ${postLoginUrl}`);
    console.log(`🔑 [${shortId}] Post-login title: "${postLoginTitle}"`);

    // ── Step 7.5: Handle post-login "ดำเนินการต่อ" page ──
    try {
      const postLoginClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return text; }
        }
        return null;
      });
      if (postLoginClicked) {
        console.log(`🔑 [${shortId}] Post-login: clicked "${postLoginClicked}"`);
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (e) { /* non-critical */ }

    // ── Step 8: Check various outcomes ──
    if (postLoginUrl.includes('checkpoint') || postLoginUrl.includes('two_step_verification') || postLoginUrl.includes('recover') || postLoginUrl.includes('captcha')) {
      console.log(`⚠️ [${shortId}] Checkpoint/verification required`);
      return res.json({ success: false, error: 'Facebook ต้องการยืนยันตัวตน (2FA/Checkpoint) — กรุณาลองเปิดหน้าต่าง Browser ด้วยตนเอง' });
    }

    // Check for error messages
    const errorMsg = await page.evaluate(() => {
      const errEl = document.querySelector('#login_error, .login_error_box, [data-sigil="m_login_notice"], [role="alert"]');
      return errEl ? errEl.textContent?.trim() : '';
    }).catch(() => '');

    if (errorMsg) {
      console.log(`❌ [${shortId}] Login error: ${errorMsg.substring(0, 100)}`);
      return res.json({ success: false, error: errorMsg });
    }

    // Check if login form is still present → login failed
    const stillHasLoginForm = await page.evaluate(() => {
      return !!(document.querySelector('input[name="email"]') ||
                document.querySelector('input[name="pass"]') ||
                document.querySelector('#email') ||
                document.querySelector('#pass'));
    }).catch(() => true);

    if (stillHasLoginForm) {
      console.log(`❌ [${shortId}] Login form still visible — login failed`);
      // Take screenshot of the page for debugging
      const bodyText = await page.evaluate(() => document.body.innerText?.substring(0, 500) || '').catch(() => '');
      console.log(`❌ [${shortId}] Page text: ${bodyText.substring(0, 200)}`);
      return res.json({ success: false, error: 'Login ไม่สำเร็จ — รหัสผ่านอาจไม่ถูกต้อง หรือ Facebook ต้องการยืนยันตัวตน' });
    }

    // ── Step 9: Login appears successful — scrape user info ──
    console.log(`✅ [${shortId}] Login successful! Scraping user info...`);

    // Wait a bit more for the page to fully settle
    await new Promise(r => setTimeout(r, 3000));

    const activeSlot = sessionManager.getActiveSlot(req.userId);
    const userInfo = await scrapeFbUserInfo(page);
    
    if (userInfo.name) {
      sessionManager.setFbSession(req.userId, activeSlot, { name: userInfo.name, profilePic: userInfo.profilePic || '' });
      console.log(`✅ [${shortId}] Saved FB session: "${userInfo.name}" (slot ${activeSlot})`);
    } else {
      // Login worked but couldn't get name — save with "Facebook User" as last resort
      sessionManager.setFbSession(req.userId, activeSlot, { name: 'Facebook User', profilePic: userInfo.profilePic || '' });
      console.log(`⚠️ [${shortId}] Login OK but couldn't scrape name — saved as "Facebook User"`);
    }

    // Store encrypted credentials for scheduled auto re-login
    sessionManager.saveFbCredentials(req.userId, activeSlot, email, password);

    return res.json({ 
      success: true, 
      message: `Login สำเร็จ!${userInfo.name ? ` ยินดีต้อนรับ ${userInfo.name}` : ''}`, 
      slot: activeSlot,
      user: { name: userInfo.name || 'Facebook User', profilePic: userInfo.profilePic || '' }
    });

  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('not clickable') || msg.includes('Target closed') || msg.includes('context was destroyed')) {
      console.log('🔇 Auto-login skipped (stale browser)');
    } else {
      console.warn('⚠️ Auto-login error:', msg);
    }
    res.json({ success: false, error: `Login ผิดพลาด: ${msg}` });
  }
});

// Re-login to Facebook using stored credentials (slot-specific)
// Used by re-login button + pre-automation session freshness check
app.post('/api/facebook/re-login', ...auth, async (req, res) => {
  try {
    const { slot } = req.body;
    const targetSlot = typeof slot === 'number' ? slot : sessionManager.getActiveSlot(req.userId);
    const shortId = req.userId.substring(0, 8);

    // Load stored credentials for this slot
    const creds = sessionManager.loadFbCredentials(req.userId, targetSlot);
    if (!creds || !creds.email || !creds.password) {
      return res.json({
        success: false,
        needCredentials: true,
        error: 'ไม่มีข้อมูล Email/Password ที่บันทึกไว้สำหรับ Slot นี้ — กรุณากรอก Email และ Password',
      });
    }

    // Set active slot to target
    sessionManager.setActiveSlot(req.userId, targetSlot);

    // Ensure browser is initialized
    if (!req.groupWorker.browser || !req.groupWorker.page) {
      console.log(`🔑 [${shortId}] Re-login: initializing browser for slot ${targetSlot}...`);
      try {
        await req.groupWorker.initialize();
      } catch (initErr) {
        return res.json({ success: false, error: `เปิด Browser ไม่สำเร็จ: ${initErr.message}` });
      }
    }

    // Attempt auto re-login using stored credentials
    console.log(`🔑 [${shortId}] Re-login slot ${targetSlot}: using stored credentials (${creds.email.substring(0, 4)}***)...`);
    const reloginOk = await sessionManager._autoReloginFb(req.groupWorker, creds.email, creds.password, shortId);

    if (reloginOk) {
      // Scrape fresh user info
      const page = req.groupWorker.page;
      await new Promise(r => setTimeout(r, 2000));
      const userInfo = await scrapeFbUserInfo(page);
      const name = userInfo.name || 'Facebook User';
      const profilePic = userInfo.profilePic || '';

      sessionManager.setFbSession(req.userId, targetSlot, { name, profilePic });
      console.log(`✅ [${shortId}] Re-login slot ${targetSlot} successful: ${name}`);

      return res.json({
        success: true,
        message: `เข้าสู่ระบบใหม่สำเร็จ! ${name}`,
        slot: targetSlot,
        user: { name, profilePic },
      });
    } else {
      console.log(`❌ [${shortId}] Re-login slot ${targetSlot} failed`);
      return res.json({
        success: false,
        error: 'เข้าสู่ระบบใหม่ไม่สำเร็จ — Facebook อาจต้องการยืนยันตัวตน หรือรหัสผ่านเปลี่ยน',
      });
    }
  } catch (error) {
    console.error('Re-login error:', error.message);
    res.json({ success: false, error: `Re-login ผิดพลาด: ${error.message}` });
  }
});

// Session health check — returns session age + whether re-login is recommended
app.get('/api/facebook/session-health', ...auth, (req, res) => {
  try {
    const sessions = sessionManager.getFbSessions(req.userId);
    const activeSlot = sessionManager.getActiveSlot(req.userId);
    const now = Date.now();
    const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

    const slotHealth = sessions.map((s, i) => {
      if (!s || !s.name) return { slot: i, connected: false, hasCredentials: false, needsRelogin: false, ageDays: 0 };
      const connectedAt = s.connectedAt ? new Date(s.connectedAt).getTime() : 0;
      const ageMs = connectedAt ? now - connectedAt : Infinity;
      const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000) * 10) / 10;
      const hasCredentials = sessionManager.hasFbCredentials(req.userId, i);
      return {
        slot: i,
        connected: true,
        name: s.name,
        connectedAt: s.connectedAt,
        ageDays,
        hasCredentials,
        needsRelogin: ageMs > SESSION_MAX_AGE_MS,
      };
    });

    // Check active slot specifically
    const activeHealth = slotHealth[activeSlot] || { connected: false, needsRelogin: false };

    res.json({
      success: true,
      activeSlot,
      activeNeedsRelogin: activeHealth.connected && activeHealth.needsRelogin,
      activeHasCredentials: activeHealth.hasCredentials || false,
      slots: slotHealth,
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Check Facebook connection status — returns ALL session slots + live check
app.get('/api/facebook/status', ...auth, async (req, res) => {
  try {
    const sessions = sessionManager.getFbSessions(req.userId);
    const activeSlot = sessionManager.getActiveSlot(req.userId);

    // Live-check the ACTIVE slot only if browser is open
    // IMPORTANT: Only check login state, do NOT re-scrape on every poll
    let liveConnected = false;
    if (req.groupWorker.browser && req.groupWorker.page) {
      try {
        const isLoggedIn = await Promise.race([
          req.groupWorker.checkLoginQuick(),
          new Promise(resolve => setTimeout(() => resolve(false), 5000)),
        ]);
        if (isLoggedIn) {
          liveConnected = true;
        }
      } catch (e) { /* check failed, non-fatal */ }
    }

    // Build response: backward-compatible (connected/user) + new multi-session fields
    const connectedCount = sessions.filter(s => s && s.name).length;
    const firstConnected = sessions.find(s => s && s.name);

    return res.json({
      success: true,
      // Backward compat
      connected: liveConnected || connectedCount > 0,
      user: firstConnected ? { name: firstConnected.name, profilePic: firstConnected.profilePic, connectedAt: firstConnected.connectedAt } : null,
      // Multi-session data
      sessions: sessions.map((s, i) => s ? { slot: i, name: s.name, profilePic: s.profilePic, connectedAt: s.connectedAt } : { slot: i, name: null, profilePic: null, connectedAt: null }),
      activeSlot,
      connectedCount,
      message: liveConnected ? 'เชื่อมต่อ Facebook สำเร็จ' : (connectedCount > 0 ? `มี ${connectedCount} session ที่เชื่อมต่อ` : 'ยังไม่ได้เชื่อมต่อ Facebook'),
    });
  } catch (error) {
    res.json({ success: true, connected: false, sessions: [], activeSlot: 0, connectedCount: 0, message: 'ยังไม่ได้เชื่อมต่อ Facebook' });
  }
});

// Disconnect a specific Facebook session slot — actually logout
app.post('/api/facebook/disconnect', ...auth, async (req, res) => {
  try {
    const slot = parseInt(req.body.slot ?? sessionManager.getActiveSlot(req.userId));
    console.log(`🔌 [FB] Disconnect slot ${slot} (user ${req.userId.substring(0, 8)})`);

    const isActiveSlot = slot === sessionManager.getActiveSlot(req.userId);

    // If this is the active slot and browser is open → clear FB cookies then close
    if (isActiveSlot && req.groupWorker.browser && req.groupWorker.page) {
      try {
        // Navigate to Facebook and clear cookies to truly logout
        const client = await req.groupWorker.page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        console.log('🍪 Cleared Facebook cookies & cache');
      } catch (e) {
        console.log('⚠️ Cookie clear failed (non-fatal):', e.message);
      }
      await req.groupWorker.close();
      sessionManager.registerBrowserClose();
    } else {
      // Not the active slot — delete the profile directory cookies
      const profileDir = path.join(process.cwd(), 'profiles', req.userId, `fb-session-${slot}`);
      const cookiesPath = path.join(profileDir, 'Default', 'Cookies');
      const cookiesJournalPath = path.join(profileDir, 'Default', 'Cookies-journal');
      try {
        const fs = await import('fs');
        if (fs.existsSync(cookiesPath)) { fs.unlinkSync(cookiesPath); console.log(`🍪 Deleted cookies for slot ${slot}`); }
        if (fs.existsSync(cookiesJournalPath)) fs.unlinkSync(cookiesJournalPath);
      } catch (e) {
        console.log('⚠️ Profile cookie delete failed (non-fatal):', e.message);
      }
    }

    // Clear session metadata
    sessionManager.clearFbSession(req.userId, slot);
    res.json({ success: true, message: `Logout Session ${slot + 1} สำเร็จ`, slot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm Facebook login (after user logs in manually) — saves to active slot
app.post('/api/facebook/confirm-login', ...auth, async (req, res) => {
  try {
    if (!req.groupWorker.browser || !req.groupWorker.page) {
      return res.json({ success: false, connected: false, message: 'Browser not ready' });
    }

    const page = req.groupWorker.page;
    const activeSlot = sessionManager.getActiveSlot(req.userId);
    const shortId = req.userId.substring(0, 8);

    // Handle "Continue as" / "ดำเนินการต่อ" page first
    try {
      const clickedContinue = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === 'ดำเนินการต่อ' || text === 'Continue' || text === 'Log Into') {
            btn.click();
            return text;
          }
        }
        return null;
      });
      if (clickedContinue) {
        console.log(`🔗 [confirm-login] [${shortId}] Auto-clicked "${clickedContinue}" on profile chooser`);
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (e) { /* non-critical */ }

    // Check if login form is present on current page
    const hasLoginForm = await page.evaluate(() => {
      return !!(document.querySelector('input[name="email"]') ||
                document.querySelector('input[name="pass"]') ||
                document.querySelector('#email') ||
                document.querySelector('#pass'));
    }).catch(() => true);

    // Check page title for explicit login keywords (NOT just 'facebook' — homepage also has that title)
    const pageTitle = await page.title().catch(() => '');
    const titleLower = pageTitle.toLowerCase();
    const titleIsLogin = titleLower.includes('log in') || titleLower.includes('เข้าสู่ระบบ');

    const isLoggedIn = !hasLoginForm && !titleIsLogin;
    console.log(`🔍 [confirm-login] [${shortId}] hasLoginForm=${hasLoginForm} titleIsLogin=${titleIsLogin} title="${pageTitle}" → logged_in=${isLoggedIn}`);

    if (isLoggedIn) {
      const userInfo = await scrapeFbUserInfo(page);
      const userData = { name: userInfo.name || 'Facebook User', profilePic: userInfo.profilePic || '', connectedAt: new Date().toISOString() };
      sessionManager.setFbSession(req.userId, activeSlot, userData);
      console.log(`✅ [confirm-login] [${shortId}] Saved: "${userData.name}" (slot ${activeSlot})`);
      res.json({ success: true, connected: true, user: userData, slot: activeSlot, message: 'เชื่อมต่อ Facebook สำเร็จ!' });
    } else {
      res.json({ success: false, connected: false, message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดอยู่' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// Marketplace Posting Automation Endpoints
// ====================================

// Start marketplace automation (Marketplace + tick groups in batches of 20)
app.post('/api/marketplace-automation/start', ...auth, async (req, res) => {
  try {
    const { property, groups, caption, images, delayMinutes, delaySeconds, captionStyle, claudeApiKey, browser, userPackage } = req.body;

    if (!property) {
      return res.status(400).json({ success: false, error: 'Property is required' });
    }
    if (!groups || groups.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one group is required' });
    }

    // Validate post limit based on package
    const packageLimits = { free: 10, agent: 300, elite: 750 };
    const limit = packageLimits[userPackage] || 10;
    if (groups.length > limit) {
      return res.status(400).json({
        success: false,
        error: `Package ${userPackage} limit exceeded`,
        message: `แพ็กเกจ ${userPackage.toUpperCase()} จำกัด ${limit} โพสต์/วัน คุณเลือก ${groups.length} กลุ่ม`
      });
    }

    // If groupWorker has an active browser, let marketplace borrow it
    if (req.groupWorker.browser && req.groupWorker.browser.isConnected()) {
      console.log('🔗 Marketplace borrowing browser from req.groupWorker...');
      req.marketplaceWorker.borrowBrowser(req.groupWorker.browser, req.groupWorker.page);
    }

    // Run pre-flight check SYNCHRONOUSLY to return limit errors immediately
    const tracker = req.marketplaceWorker.tracker;
    const preflight = tracker.preflightCheck(
      property.id,
      groups.map(g => g.id),
      userPackage || 'free'
    );

    if (!preflight.canProceed) {
      const reason = preflight.dailyRemaining === 0
        ? `ถึงลิมิตวันนี้แล้ว (${preflight.dailyLimit} โพสต์) รีเซ็ตตี 5`
        : `กลุ่มทั้งหมดถูกโพสต์ไปแล้ววันนี้`;
      return res.json({
        success: false,
        error: reason,
        errorType: 'limit_reached',
        tasks: [],
        dailyStats: tracker.getTodayStats(userPackage || 'free'),
      });
    }

    // Use queue system for Marketplace
    const session = sessionManager.getSession(req.userId);
    const displayName = session?.displayName || session?.email?.split('@')[0] || req.userId.substring(0, 8);
    const mktActiveSlot = session?.activeSlot || 0;
    const mktFbSession = session?.fbSessions?.[mktActiveSlot];
    const mktFbAccount = mktFbSession?.name || null;

    const automationConfig = {
      property,
      groups: preflight.canPost, // Only use allowed groups
      caption,
      images: images || property.images || [],
      delayMinutes: delayMinutes || undefined,
      delaySeconds: delaySeconds || undefined,
      captionStyle: captionStyle || 'friendly',
      browser: browser || 'chrome',
      userPackage: userPackage || 'free',
      claudeApiKey,
    };

    const queueResult = await automationQueue.tryStartOrEnqueue(
      req.userId,
      (cfg) => req.marketplaceWorker.startMarketplaceAutomation(cfg),
      automationConfig,
      { worker: req.marketplaceWorker, displayName, email: session?.email || null, fbAccount: mktFbAccount, propertyTitle: property?.title || null, automationType: 'marketplace' }
    );

    if (queueResult.queued) {
      console.log(`📋 User ${req.userId.substring(0, 8)} queued at position ${queueResult.position}`);
      return res.json({
        success: true,
        queued: true,
        position: queueResult.position,
        estimatedWaitSec: queueResult.estimatedWaitSec,
        message: `คิวที่ ${queueResult.position} — รอประมาณ ${Math.ceil(queueResult.estimatedWaitSec / 60)} นาที`,
        skippedDuplicate: preflight.skippedDuplicate.length,
        skippedOverLimit: preflight.skippedOverLimit.length,
        totalGroups: preflight.canPost.length,
      });
    }

    // Started immediately
    await new Promise(r => setTimeout(r, 200));
    const status = req.marketplaceWorker.getStatus();

    // Return immediately with "started" response
    res.json({
      success: true,
      message: `เริ่ม automation แล้ว — ${preflight.canPost.length} กลุ่ม (${Math.ceil(preflight.canPost.length / 20)} batches)`,
      skippedDuplicate: preflight.skippedDuplicate.length,
      skippedOverLimit: preflight.skippedOverLimit.length,
      totalGroups: preflight.canPost.length,
      isRunning: status.isRunning,
      isPaused: status.isPaused,
      currentStep: status.currentStep,
      totalSteps: status.totalSteps,
      tasks: status.tasks,
      logs: status.logs,
      startTime: status.startTime,
      endTime: status.endTime,
      generatedCaptions: status.generatedCaptions,
    });
  } catch (error) {
    console.error('Marketplace automation start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get marketplace automation status
app.get('/api/marketplace-automation/status', ...auth, (req, res) => {
  try {
    const status = req.marketplaceWorker.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause marketplace automation
app.post('/api/marketplace-automation/pause', ...auth, (req, res) => {
  try {
    req.marketplaceWorker.pause();
    res.json({ success: true, message: 'Marketplace automation paused' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume marketplace automation
app.post('/api/marketplace-automation/resume', ...auth, (req, res) => {
  try {
    req.marketplaceWorker.resume();
    res.json({ success: true, message: 'Marketplace automation resumed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop marketplace automation
app.post('/api/marketplace-automation/stop', ...auth, async (req, res) => {
  try {
    const wasQueued = automationQueue.cancelQueue(req.userId);
    await req.marketplaceWorker.stop();
    if (!wasQueued) {
      automationQueue._onJobComplete(req.userId, false);
    }
    res.json({ success: true, message: 'Marketplace automation stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SCHEDULED POSTING API
// ============================================

// Get all schedules
app.get('/api/schedules', ...auth, (req, res) => {
  res.json({ success: true, schedules: req.scheduler.getSchedules() });
});

// Poll schedule notifications (consumed on read) — must be before :id routes
app.get('/api/schedules/notifications', ...auth, (req, res) => {
  const notifications = sessionManager.pollScheduleNotifications(req.userId);
  res.json({ success: true, notifications });
});

// Create a new scheduled post
app.post('/api/schedules', ...auth, (req, res) => {
  try {
    const { scheduledAt, mode, property, groups, caption, images, delaySeconds, captionStyle, userPackage, browser, fbSlot, fbAccountName } = req.body;
    if (!scheduledAt || !mode || !property || !groups?.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const slotToUse = fbSlot ?? sessionManager.getActiveSlot(req.userId);
    const hasCredentials = sessionManager.hasFbCredentials(req.userId, slotToUse);

    const schedule = req.scheduler.addSchedule({
      scheduledAt, mode, property, groups, caption, images, delaySeconds, captionStyle, userPackage, browser,
      fbSlot: slotToUse,
      fbAccountName: fbAccountName || null,
    });

    res.json({
      success: true,
      schedule,
      hasCredentials,
      warning: !hasCredentials ? 'ไม่พบข้อมูล Login สำหรับ slot นี้ — หากถึงเวลาแล้ว session หมดอายุ อาจไม่สามารถ re-login ได้อัตโนมัติ กรุณา Login Facebook ก่อนตั้งเวลา' : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel a scheduled post
app.post('/api/schedules/:id/cancel', ...auth, (req, res) => {
  const ok = req.scheduler.cancelSchedule(req.params.id);
  res.json({ success: ok, message: ok ? 'Cancelled' : 'Not found or already running' });
});

// Delete a scheduled post
app.delete('/api/schedules/:id', ...auth, (req, res) => {
  const ok = req.scheduler.deleteSchedule(req.params.id);
  res.json({ success: ok });
});

// ============================================
// ANALYTICS API
// ============================================

// Get posting analytics (aggregated from postingTracker)
app.get('/api/analytics', ...auth, (req, res) => {
  try {
    const { userPackage, days } = req.query;
    const tracker = req.postingTracker;
    const todayStats = tracker.getTodayStats(userPackage || 'free');
    const history = tracker.history || {};
    const archive = history.dailyArchive || {};
    const currentDay = history.currentDay;

    // Build daily data from dailyArchive + today
    const dailyData = [];
    const now = new Date();
    const numDays = parseInt(days) || 7;

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      if (dateStr === currentDay) {
        // Today — use live todayStats
        const ts = history.todayStats || {};
        dailyData.push({
          date: dateStr,
          posts: ts.postsCount || 0,
          success: ts.successCount || 0,
          failed: ts.failedCount || 0,
          groups: ts.groupsPosted?.length || 0,
        });
      } else if (archive[dateStr]) {
        // Archived day
        const a = archive[dateStr];
        dailyData.push({
          date: dateStr,
          posts: a.postsCount || 0,
          success: a.successCount || 0,
          failed: a.failedCount || 0,
          groups: a.groupsPosted?.length || 0,
        });
      } else {
        dailyData.push({ date: dateStr, posts: 0, success: 0, failed: 0, groups: 0 });
      }
    }

    // Group performance from groupStats
    const groupPerformance = [];
    if (history.groupStats) {
      for (const [groupId, stats] of Object.entries(history.groupStats)) {
        groupPerformance.push({
          groupId,
          groupName: stats.name || stats.groupName || groupId,
          totalPosts: stats.totalPosts || 0,
          successCount: stats.successCount || 0,
          failedCount: stats.failedCount || 0,
          lastPosted: stats.lastPosted,
          successRate: stats.totalPosts > 0 ? Math.round(((stats.successCount || 0) / stats.totalPosts) * 100) : 0,
          propertiesCount: stats.properties?.length || 0,
        });
      }
    }

    // Sort by total posts descending
    groupPerformance.sort((a, b) => b.totalPosts - a.totalPosts);

    // Calculate all-time totals from postings array
    const allPostings = history.postings || [];
    const totalPostsAllTime = allPostings.length;
    const totalSuccessAllTime = allPostings.filter(p => p.success).length;
    const totalFailedAllTime = allPostings.filter(p => !p.success).length;

    res.json({
      success: true,
      today: todayStats,
      dailyData,
      groupPerformance: groupPerformance.slice(0, 50),
      summary: {
        totalPostsAllTime,
        totalSuccessAllTime,
        totalFailedAllTime,
        totalGroupsPosted: groupPerformance.length,
        avgSuccessRate: totalPostsAllTime > 0 ? Math.round((totalSuccessAllTime / totalPostsAllTime) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HEALTH CHECK — Real-time risk scoring from actual posting data
// ============================================
app.get('/api/health-check', ...auth, (req, res) => {
  try {
    const tracker = req.postingTracker;
    tracker.checkDailyReset();
    const history = tracker.history || {};
    const postings = history.postings || [];
    const todayStats = history.todayStats || {};
    const archive = history.dailyArchive || {};

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const todayDate = history.currentDay;

    // --- Gather today's postings with timestamps ---
    const todayPostings = postings.filter(p => p.day === todayDate);
    const todayTimestamps = todayPostings.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);

    // Posts this hour
    const postsThisHour = todayTimestamps.filter(t => t > oneHourAgo).length;
    const postsToday = todayPostings.length;

    // --- Delays between posts (minutes) ---
    const delays = [];
    for (let i = 1; i < todayTimestamps.length; i++) {
      delays.push((todayTimestamps[i] - todayTimestamps[i - 1]) / 60000);
    }
    const avgDelay = delays.length > 0 ? delays.reduce((s, v) => s + v, 0) / delays.length : -1;
    const minDelay = delays.length > 0 ? Math.min(...delays) : -1;

    // --- Caption diversity (property diversity as proxy) ---
    const todayProperties = new Set(todayPostings.map(p => p.propertyId));
    const uniqueProperties = todayProperties.size;
    const diversityRatio = postsToday > 0 ? uniqueProperties / postsToday : 1;

    // --- Interval coefficient of variation (bot detection) ---
    let intervalCV = -1;
    if (delays.length >= 2) {
      const mean = delays.reduce((s, v) => s + v, 0) / delays.length;
      if (mean > 0) {
        const variance = delays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / delays.length;
        intervalCV = Math.sqrt(variance) / mean;
      } else {
        intervalCV = 0;
      }
    }

    // --- Weekly acceleration ---
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    let thisWeekCount = 0;
    let lastWeekCount = 0;
    // Count from archive + today
    for (const [dateStr, dayData] of Object.entries(archive)) {
      const dt = new Date(dateStr).getTime();
      if (dt > oneWeekAgo) thisWeekCount += (dayData.postsCount || 0);
      else if (dt > twoWeeksAgo) lastWeekCount += (dayData.postsCount || 0);
    }
    thisWeekCount += postsToday; // add today

    // --- Session duration (from first to last post today) ---
    let sessionMinutes = 0;
    if (todayTimestamps.length >= 2) {
      sessionMinutes = (todayTimestamps[todayTimestamps.length - 1] - todayTimestamps[0]) / 60000;
    }

    // --- Account age (days since first ever posting) ---
    let accountAgeDays = 0;
    if (postings.length > 0) {
      const firstEver = new Date(postings[0].timestamp).getTime();
      accountAgeDays = Math.floor((now - firstEver) / (24 * 60 * 60 * 1000));
    }

    // --- Success rate today ---
    const successToday = todayStats.successCount || 0;
    const failedToday = todayStats.failedCount || 0;
    const successRate = postsToday > 0 ? Math.round((successToday / postsToday) * 100) : 100;

    // --- Automation runs today ---
    const automationRuns = todayStats.automationRuns || 0;

    res.json({
      success: true,
      data: {
        postsToday,
        postsThisHour,
        postsThisWeek: thisWeekCount,
        postsLastWeek: lastWeekCount,
        avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 10) / 10 : -1,
        minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 10) / 10 : -1,
        intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
        diversityRatio: Math.round(diversityRatio * 100) / 100,
        uniqueProperties,
        sessionMinutes: Math.round(sessionMinutes),
        accountAgeDays,
        successRate,
        automationRuns,
        successToday,
        failedToday,
        timestamps: todayTimestamps,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NOTIFICATIONS — Poll for admin replies to user's support tickets
// ============================================
app.get('/api/notifications/poll', ...auth, async (req, res) => {
  try {
    const supaUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supaUrl || !serviceKey) return res.json({ success: true, notifications: [] });

    // Get user's tickets that have an admin reply
    const resp = await fetch(
      `${supaUrl}/rest/v1/support_tickets?user_id=eq.${req.userId}&admin_reply=not.is.null&select=id,subject,category,admin_reply,admin_replied_at,status&order=admin_replied_at.desc&limit=10`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!resp.ok) return res.json({ success: true, notifications: [] });
    const tickets = await resp.json();

    // Check which replies user has already seen (stored in session)
    const session = sessionManager.getSession(req.userId);
    const seenReplies = session?._seenTicketReplies || new Set();

    const newNotifications = [];
    for (const t of tickets) {
      const replyKey = `${t.id}_${t.admin_replied_at}`;
      if (!seenReplies.has(replyKey)) {
        seenReplies.add(replyKey);
        newNotifications.push({
          id: replyKey,
          type: 'admin_reply',
          category: 'admin',
          title: `ผู้ดูแลตอบกลับ: ${t.subject}`,
          message: t.admin_reply.substring(0, 200),
          ticketId: t.id,
          timestamp: new Date(t.admin_replied_at).getTime(),
        });
      }
    }

    // Persist seen set back to session
    if (session) session._seenTicketReplies = seenReplies;

    res.json({ success: true, notifications: newNotifications });
  } catch (error) {
    console.error('Notification poll error:', error);
    res.json({ success: true, notifications: [] });
  }
});

// ============================================
// SUPPORT TICKETS — Delete a ticket (owner only)
// ============================================
app.delete('/api/support-tickets/:id', ...auth, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const supaUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supaUrl || !serviceKey) return res.status(500).json({ success: false, error: 'Supabase not configured' });

    // Verify ownership first
    const checkResp = await fetch(
      `${supaUrl}/rest/v1/support_tickets?id=eq.${ticketId}&user_id=eq.${req.userId}&select=id`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!checkResp.ok) return res.status(500).json({ success: false, error: 'DB error' });
    const found = await checkResp.json();
    if (!found || found.length === 0) return res.status(403).json({ success: false, error: 'Not your ticket' });

    // Delete
    const delResp = await fetch(
      `${supaUrl}/rest/v1/support_tickets?id=eq.${ticketId}`,
      { method: 'DELETE', headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!delResp.ok) throw new Error('Delete failed');

    res.json({ success: true });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WORKER SLOTS — Real-time node status for factory monitor
// ============================================
app.get('/api/worker-slots', ...adminAuth, (req, res) => {
  try {
    const stats = automationQueue.getQueueStats();
    const maxSlots = stats.maxConcurrent || 10;
    const now = Date.now();

    // Build slot array: running jobs fill first, then standby
    const slots = [];
    const runningEntries = stats.running || [];
    const queueEntries = stats.queue || [];

    for (let i = 0; i < maxSlots; i++) {
      const slotNum = String(i + 1).padStart(3, '0');

      if (i < runningEntries.length) {
        // Active slot — pull real data from worker
        const job = runningEntries[i];
        const worker = automationQueue.running.get(job.fullUserId)?.worker;
        const workerStatus = worker && typeof worker.getStatus === 'function' ? worker.getStatus() : null;

        // Get logs from worker
        let logs = [];
        if (workerStatus && Array.isArray(workerStatus.logs)) {
          logs = workerStatus.logs.slice(-50).map(l => ({
            time: l.time,
            msg: l.msg,
            level: l.level || 'info',
          }));
        }

        // Get tasks summary
        const tasks = workerStatus?.tasks || [];
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'pending_approval').length;
        const failed = tasks.filter(t => t.status === 'failed').length;
        const total = workerStatus?.totalSteps || tasks.length;

        slots.push({
          slotId: slotNum,
          status: workerStatus?.isPaused ? 'paused' : 'running',
          userId: job.userId,
          fullUserId: job.fullUserId,
          displayName: job.displayName || 'User',
          fbAccount: job.fbAccount || null,
          propertyTitle: job.propertyTitle || null,
          automationType: job.automationType || 'group',
          groupCount: job.groupCount,
          startedAt: job.startedAt,
          runningSec: job.runningSec,
          progress: { completed, failed, total, percent: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0 },
          logs,
          generatedCaptions: workerStatus?.generatedCaptions || [],
        });
      } else {
        // Standby slot
        slots.push({
          slotId: slotNum,
          status: 'standby',
          userId: null,
          displayName: null,
          fbAccount: null,
          propertyTitle: null,
          automationType: null,
          groupCount: 0,
          startedAt: null,
          runningSec: 0,
          progress: { completed: 0, failed: 0, total: 0, percent: 0 },
          logs: [],
          generatedCaptions: [],
        });
      }
    }

    // Queue entries (waiting)
    const waiting = queueEntries.map(q => ({
      userId: q.userId,
      displayName: q.displayName,
      groupCount: q.groupCount,
      waitingSec: q.waitingSec,
      automationType: q.automationType,
    }));

    // Build per-slot anti-detection from real worker data
    // Aggregate: if ANY slot is active, show its real modules; otherwise show idle state
    let aggregatedAntiDetection = {
      gaussianJitter: { status: 'OFF', active: false },
      fingerprintMasking: { status: 'OFF', active: false },
      webrtcShield: { status: 'OFF', active: false },
      behaviorSimulation: { status: 'OFF', active: false },
      canvasNoise: { status: 'OFF', active: false },
      networkStealth: { status: 'OFF', active: false },
    };
    for (const [uid, job] of automationQueue.running.entries()) {
      const worker = job.worker;
      if (worker && typeof worker.getAntiDetectionStatus === 'function') {
        const ad = worker.getAntiDetectionStatus();
        for (const key of Object.keys(aggregatedAntiDetection)) {
          if (ad[key]?.active) {
            aggregatedAntiDetection[key] = ad[key];
          }
        }
        break; // Use first active worker's data
      }
    }

    // Also attach per-slot antiDetection to each active slot
    for (const slot of slots) {
      if (slot.status !== 'standby' && slot.fullUserId) {
        const job = automationQueue.running.get(slot.fullUserId);
        const worker = job?.worker;
        if (worker && typeof worker.getAntiDetectionStatus === 'function') {
          slot.antiDetection = worker.getAntiDetectionStatus();
        }
      }
    }

    res.json({
      success: true,
      maxSlots,
      activeCount: runningEntries.length,
      queueCount: queueEntries.length,
      slots,
      waiting,
      antiDetection: aggregatedAntiDetection,
    });
  } catch (error) {
    console.error('Worker slots error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SECURITY SCORE — Weighted 4-module anti-detection scoring
// Network 35%, Fingerprint 25%, Behavioral 25%, Content 15%
// ============================================
app.get('/api/security-score', ...auth, (req, res) => {
  try {
    const tracker = req.postingTracker;
    tracker.checkDailyReset();
    const history = tracker.history || {};
    const postings = history.postings || [];
    const todayDate = history.currentDay;

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Gather today's posting timestamps
    const todayPostings = postings.filter(p => p.day === todayDate);
    const todayTimestamps = todayPostings.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);
    const postsThisHour = todayTimestamps.filter(t => t > oneHourAgo).length;
    const postsToday = todayPostings.length;

    // Delays between posts (minutes)
    const delays = [];
    for (let i = 1; i < todayTimestamps.length; i++) {
      delays.push((todayTimestamps[i] - todayTimestamps[i - 1]) / 60000);
    }
    const avgDelay = delays.length > 0 ? delays.reduce((s, v) => s + v, 0) / delays.length : -1;
    const minDelay = delays.length > 0 ? Math.min(...delays) : -1;

    // Interval coefficient of variation
    let intervalCV = -1;
    if (delays.length >= 2) {
      const mean = delays.reduce((s, v) => s + v, 0) / delays.length;
      if (mean > 0) {
        const variance = delays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / delays.length;
        intervalCV = Math.sqrt(variance) / mean;
      }
    }

    // Content diversity
    const todayProperties = new Set(todayPostings.map(p => p.propertyId));
    const diversityRatio = postsToday > 0 ? todayProperties.size / postsToday : 1;

    // Account age
    let accountAgeDays = 0;
    if (postings.length > 0) {
      const firstEver = new Date(postings[0].timestamp).getTime();
      accountAgeDays = Math.floor((now - firstEver) / (24 * 60 * 60 * 1000));
    }

    // Import and call the security score engine
    import('./services/antiDetection.js').then(({ calculateSecurityScore }) => {
      const result = calculateSecurityScore({
        postsToday,
        postsThisHour,
        avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 100) / 100 : -1,
        minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 100) / 100 : -1,
        intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
        accountAgeDays,
        fingerprintActive: true,  // Always on (injected via evaluateOnNewDocument)
        webrtcBlocked: true,      // Always on (browser args + JS injection)
        warmupDone: req.session?.warmupDone || false,
        imagesMutated: true,      // Always on (mutateImageBuffer in worker)
        captionsAI: true,         // Always on (Claude/template captions)
        diversityRatio: Math.round(diversityRatio * 100) / 100,
        postingHour: new Date().getHours(),
        isResidentialProxy: false, // VPS datacenter IP by default
      });

      res.json({
        success: true,
        ...result,
        raw: {
          postsToday,
          postsThisHour,
          avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 10) / 10 : -1,
          minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 10) / 10 : -1,
          intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
          accountAgeDays,
          diversityRatio: Math.round(diversityRatio * 100) / 100,
        },
      });
    }).catch(err => {
      console.error('Security score calc error:', err);
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (error) {
    console.error('Security score error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset all posting analytics data
app.post('/api/analytics/reset', ...auth, (req, res) => {
  try {
    req.postingTracker.resetAll();
    console.log('✅ Analytics data reset via API');
    res.json({ success: true, message: 'All analytics data reset' });
  } catch (error) {
    console.error('❌ Reset failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
  if (ADMIN_EMAILS.length === 0) {
    console.warn('⚠️  ADMIN_EMAILS is empty — /api/admin/* endpoints will reject ALL requests');
  } else {
    console.log(`🛡️  Admin emails: ${ADMIN_EMAILS.join(', ')}`);
  }
});
