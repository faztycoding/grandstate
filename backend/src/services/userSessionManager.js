import { GroupPostingWorker } from './groupPostingWorker.js';
import { MarketplaceWorker } from './marketplaceWorker.js';
import { PostingTracker } from './postingTracker.js';
import { PostScheduler } from './scheduler.js';
import { automationQueue } from './automationQueue.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Simple encryption for stored FB credentials (not military-grade, but prevents plaintext on disk)
const CRED_KEY = process.env.CRED_ENCRYPT_KEY || 'gs_default_key_2024_change_me!!';
function encryptText(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(CRED_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
function decryptText(data) {
  try {
    const [ivHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(CRED_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return null; }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILES_DIR = path.resolve(__dirname, '../../profiles');

const MAX_CONCURRENT_BROWSERS = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity
const PRESENCE_TIMEOUT_MS = 12 * 1000; // 12s without heartbeat = offline (near-realtime)

/**
 * UserSessionManager — manages per-user worker instances + browser pool
 * 
 * Each user gets their own:
 * - GroupPostingWorker (with isolated browser profile)
 * - MarketplaceWorker (borrows browser from groupWorker)
 * - PostingTracker (isolated posting history)
 * - PostScheduler (isolated schedules)
 */
class UserSessionManager {
  constructor() {
    this.sessions = new Map();
    this.activeBrowsers = 0;

    // Cleanup inactive sessions every 5 minutes
    this._cleanupTimer = setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000);
  }

  /**
   * Get or create a session for the given userId
   */
  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, this._createSession(userId));
    }
    const session = this.sessions.get(userId);
    session.lastActivity = Date.now();
    return session;
  }

  touchPresence(userId, email, userMeta) {
    const session = this.getSession(userId);
    session.lastPresenceAt = Date.now();
    if (email) session.email = email;
    if (userMeta) {
      if (userMeta.display_name) session.displayName = userMeta.display_name;
      if (userMeta.full_name) session.fullName = userMeta.full_name;
      // Fallback: if no display_name, use full_name
      if (!session.displayName && userMeta.full_name) session.displayName = userMeta.full_name;
      if (userMeta.line_id) session.lineId = userMeta.line_id;
    }
    return session;
  }

  markOffline(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;
    session.lastPresenceAt = 0;
    session.lastActivity = Date.now();
  }

  getPresenceStats(adminEmails = []) {
    const now = Date.now();
    let activeUsers = 0;
    let onlineUsers = 0;
    let automationUsers = 0;
    let adminOnline = false;

    for (const [, session] of this.sessions) {
      const hasLivePresence = !!session.lastPresenceAt && (now - session.lastPresenceAt <= PRESENCE_TIMEOUT_MS);
      const hasRunningAutomation = !!(session.groupWorker.isRunning || session.marketplaceWorker.isRunning);

      if (hasLivePresence) {
        onlineUsers++;
        if (session.email && adminEmails.includes(session.email.toLowerCase())) {
          adminOnline = true;
        }
      }
      if (hasRunningAutomation) automationUsers++;
      if (hasLivePresence || hasRunningAutomation) activeUsers++;
    }

    return {
      activeUsers,
      onlineUsers,
      automationUsers,
      adminOnline,
      presenceTimeoutMs: PRESENCE_TIMEOUT_MS,
    };
  }

  _createSession(userId) {
    const shortId = userId.substring(0, 8);
    console.log(`🆕 Creating session for user: ${shortId}...`);

    const postingTracker = new PostingTracker(userId);
    const groupWorker = new GroupPostingWorker(userId);
    const marketplaceWorker = new MarketplaceWorker(userId);
    const scheduler = new PostScheduler(userId);

    // Wire postingTracker into groupWorker
    groupWorker.setPostResultCallback((propertyId, groupId, groupName, success) => {
      postingTracker.recordPosting(propertyId || 'unknown', groupId, groupName, success);
    });

    // Wire shared postingTracker into marketplaceWorker (replaces its internal tracker)
    marketplaceWorker.setTracker(postingTracker);

    // Wire pre-flight check: verify browser/session health before scheduled jobs
    // job is passed from scheduler so we can read fbSlot + credentials
    scheduler.setPreflightCheck(async (job) => {
      // Check if automation is already running
      if (groupWorker.isRunning || marketplaceWorker.isRunning) {
        return { ok: false, error: 'Automation already running — will retry next cycle', canRetry: false };
      }

      // Determine which FB slot to use (from job or default)
      const fbSlot = job?.fbSlot ?? this.getActiveSlot(userId);

      // Ensure browser uses correct FB profile slot
      groupWorker.setProfileSlot(fbSlot);

      // Check if browser is alive
      const browserAlive = groupWorker.browser && groupWorker.browser.isConnected();
      if (!browserAlive) {
        console.log(`⏰ [${shortId}] Browser not connected — re-initializing for slot ${fbSlot}...`);
        try {
          await groupWorker.initialize('chrome');
        } catch (initErr) {
          return { ok: false, error: `Browser init failed: ${initErr.message}`, canRetry: false };
        }
      }

      // Check if Facebook session is still valid
      try {
        const loggedIn = await groupWorker.checkLogin();
        if (!loggedIn) {
          console.log(`⏰ [${shortId}] FB session expired on slot ${fbSlot} — attempting auto re-login...`);

          // Try auto re-login using stored credentials
          const creds = this.loadFbCredentials(userId, fbSlot);
          if (creds && creds.email && creds.password) {
            try {
              const t0 = Date.now();
              const reloginOk = await this._autoReloginFb(groupWorker, creds.email, creds.password, shortId);
              const durationSec = Math.round((Date.now() - t0) / 1000);
              if (reloginOk) {
                console.log(`⏰ [${shortId}] Auto re-login successful!`);
                // Log re-login event to admin history
                try {
                  const fbSession = (this.getFbSessions(userId) || [])[fbSlot];
                  automationQueue.pushSystemEvent({ userId, displayName: fbSession?.name || shortId, eventType: 'relogin', success: true, detail: `slot ${fbSlot + 1}`, durationSec });
                } catch (e) { /* non-critical */ }
                return { ok: true };
              }
            } catch (reloginErr) {
              console.log(`⏰ [${shortId}] Auto re-login failed: ${reloginErr.message}`);
              // Log failed re-login event
              try {
                automationQueue.pushSystemEvent({ userId, displayName: shortId, eventType: 'relogin', success: false, detail: reloginErr.message.substring(0, 60) });
              } catch (e) { /* non-critical */ }
            }
          } else {
            console.log(`⏰ [${shortId}] No stored credentials for slot ${fbSlot}`);
          }

          return {
            ok: false,
            error: 'Facebook session expired — auto re-login failed',
            canRetry: true,
            reinit: async () => {
              console.log(`⏰ [${shortId}] Re-initializing browser for retry...`);
              try { await groupWorker.close(); } catch {}
              await groupWorker.initialize('chrome');
            }
          };
        }
      } catch (e) {
        return {
          ok: false,
          error: `Login check failed: ${e.message}`,
          canRetry: true,
          reinit: async () => {
            console.log(`⏰ [${shortId}] Browser crashed during login check — re-initializing...`);
            try { await groupWorker.close(); } catch {}
            await groupWorker.initialize('chrome');
          }
        };
      }

      return { ok: true };
    });

    // Start scheduler
    scheduler.start(async (job) => {
      const fbSlot = job.fbSlot ?? this.getActiveSlot(userId);
      const fbName = job.fbAccountName || `Slot ${fbSlot + 1}`;
      console.log(`⏰ [${shortId}] Scheduler: ${job.mode} for ${job.groups?.length} groups (FB: ${fbName}, slot ${fbSlot})`);

      // Ensure correct FB profile slot is set
      groupWorker.setProfileSlot(fbSlot);

      // Store notification for the user (they can poll this)
      this._pushScheduleNotification(userId, job);

      if (job.mode === 'marketplace') {
        return await marketplaceWorker.startMarketplaceAutomation({
          property: job.property,
          groups: job.groups,
          caption: job.caption,
          images: job.images || [],
          delaySeconds: job.delaySeconds,
          captionStyle: job.captionStyle,
          browser: job.browser,
          userPackage: job.userPackage,
        });
      } else {
        return await groupWorker.startAutomation({
          property: job.property,
          groups: job.groups,
          caption: job.caption,
          images: job.images || [],
          delaySeconds: job.delaySeconds,
          captionStyle: job.captionStyle,
          browser: job.browser,
          userPackage: job.userPackage,
        });
      }
    });

    return {
      userId,
      groupWorker,
      marketplaceWorker,
      postingTracker,
      scheduler,
      lastActivity: Date.now(),
      lastPresenceAt: Date.now(),
      createdAt: Date.now(),
      // Multi-session FB: array of connected FB accounts (indexed by slot)
      // Each entry: { slot, name, profilePic, connectedAt } or null if empty
      fbSessions: this._loadFbSessions(userId),
      activeSlot: this._loadActiveSlot(userId),
    };
  }

  // ── FB Session helpers ──
  getFbSessions(userId) {
    const session = this.getSession(userId);
    return session.fbSessions;
  }

  setFbSession(userId, slot, data) {
    const session = this.getSession(userId);
    session.fbSessions[slot] = data ? { slot, ...data, connectedAt: data.connectedAt || new Date().toISOString() } : null;
    this._saveFbSessions(userId, session.fbSessions, session.activeSlot);
  }

  clearFbSession(userId, slot) {
    const session = this.getSession(userId);
    session.fbSessions[slot] = null;
    this._saveFbSessions(userId, session.fbSessions, session.activeSlot);
  }

  getActiveSlot(userId) {
    const session = this.getSession(userId);
    return session.activeSlot || 0;
  }

  setActiveSlot(userId, slot) {
    const session = this.getSession(userId);
    session.activeSlot = slot;
    this._saveFbSessions(userId, session.fbSessions, session.activeSlot);
  }

  // ── FB Credential storage (encrypted) ──
  saveFbCredentials(userId, slot, email, password) {
    try {
      const filePath = path.join(PROFILES_DIR, userId, 'fb-credentials.enc.json');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let creds = {};
      if (fs.existsSync(filePath)) {
        try { creds = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
      }

      creds[String(slot)] = {
        email: encryptText(email),
        password: encryptText(password),
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), 'utf8');
      console.log(`🔐 Saved FB credentials for slot ${slot} (user ${userId.substring(0, 8)})`);
    } catch (e) {
      console.warn(`⚠️ Failed to save FB credentials:`, e.message);
    }
  }

  loadFbCredentials(userId, slot) {
    try {
      const filePath = path.join(PROFILES_DIR, userId, 'fb-credentials.enc.json');
      if (!fs.existsSync(filePath)) return null;
      const creds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const entry = creds[String(slot)];
      if (!entry) return null;
      return {
        email: decryptText(entry.email),
        password: decryptText(entry.password),
      };
    } catch {
      return null;
    }
  }

  hasFbCredentials(userId, slot) {
    return !!this.loadFbCredentials(userId, slot);
  }

  // ── Auto re-login helper ──
  async _autoReloginFb(groupWorker, email, password, shortId) {
    const page = groupWorker.page;
    if (!page) throw new Error('No page available');

    console.log(`🔑 [${shortId}] Auto re-login: navigating to facebook.com...`);
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Handle profile chooser page — 3 cases:
    // (A) "ดำเนินการต่อ" = same account, click to continue
    // (B) "ใช้โปรไฟล์อื่น" = different account shown, click to get login form
    // (C) No chooser = direct login form or already logged in
    try {
      const chooserAction = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
        let hasContinue = false;
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === 'ดำเนินการต่อ' || text === 'Continue') hasContinue = true;
        }
        if (!hasContinue) return 'no_chooser';
        // Profile chooser detected — click "ดำเนินการต่อ" (re-login uses stored creds for same slot)
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return 'continued'; }
        }
        return 'no_chooser';
      }).catch(() => 'no_chooser');

      if (chooserAction === 'continued') {
        console.log(`🔑 [${shortId}] Clicked "ดำเนินการต่อ" on profile chooser`);
        await new Promise(r => setTimeout(r, 5000));
        return true;
      }
    } catch (e) { /* non-critical */ }

    // Check if already logged in
    const alreadyLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="email"]') &&
             !document.querySelector('input[name="pass"]') &&
             !document.querySelector('#email') &&
             !document.querySelector('#pass');
    }).catch(() => false);

    if (alreadyLoggedIn) {
      console.log(`🔑 [${shortId}] Already logged in (cookies valid)`);
      return true;
    }

    // Fill email
    const emailField = await page.$('input[name="email"], #email');
    if (emailField) {
      await emailField.click({ clickCount: 3 });
      await emailField.type(email, { delay: 50 });
    } else {
      throw new Error('Email field not found');
    }

    // Fill password
    const passField = await page.$('input[name="pass"], #pass');
    if (passField) {
      await passField.click({ clickCount: 3 });
      await passField.type(password, { delay: 50 });
    } else {
      throw new Error('Password field not found');
    }

    // Click login
    const loginBtn = await page.$('button[name="login"], button[type="submit"], input[type="submit"]');
    if (loginBtn) {
      await loginBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Handle post-login "ดำเนินการต่อ" page (Facebook may show profile chooser again after login)
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

    // Verify login succeeded
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="email"]') &&
             !document.querySelector('#email') &&
             !document.querySelector('button[name="login"]');
    }).catch(() => false);

    return isLoggedIn;
  }

  // ── FB Session persistence ──
  _getFbSessionsPath(userId) {
    return path.join(PROFILES_DIR, userId, 'fb-sessions.json');
  }

  _saveFbSessions(userId, fbSessions, activeSlot) {
    try {
      const filePath = this._getFbSessionsPath(userId);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = { fbSessions: fbSessions || [], activeSlot: activeSlot || 0, updatedAt: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn(`⚠️ Failed to save FB sessions for ${userId.substring(0, 8)}:`, e.message);
    }
  }

  _loadFbSessions(userId) {
    try {
      const filePath = this._getFbSessionsPath(userId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.fbSessions) && data.fbSessions.some(s => s && s.name)) {
          console.log(`📂 Restored ${data.fbSessions.filter(s => s && s.name).length} FB session(s) for ${userId.substring(0, 8)}`);
          return data.fbSessions;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to load FB sessions for ${userId.substring(0, 8)}:`, e.message);
    }
    return [];
  }

  _loadActiveSlot(userId) {
    try {
      const filePath = this._getFbSessionsPath(userId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        return data.activeSlot || 0;
      }
    } catch (e) { }
    return 0;
  }

  // ── Schedule notifications (polled by frontend) ──
  _pushScheduleNotification(userId, job) {
    const session = this.sessions.get(userId);
    if (!session) return;
    if (!session.scheduleNotifications) session.scheduleNotifications = [];

    const propTitle = job.property?.title || job.property?.name || 'สินทรัพย์';
    const groupCount = job.groups?.length || 0;
    const fbName = job.fbAccountName || `Slot ${(job.fbSlot ?? 0) + 1}`;

    session.scheduleNotifications.push({
      id: `sn-${Date.now()}`,
      type: 'schedule_started',
      title: '🚀 คิวโพสต์เริ่มทำงานแล้ว',
      message: `กำลังโพสต์ "${propTitle}" ไปยัง ${groupCount} กลุ่ม ด้วยบัญชี ${fbName}`,
      jobId: job.id,
      timestamp: Date.now(),
      read: false,
    });

    console.log(`🔔 [${userId.substring(0, 8)}] Schedule notification pushed: ${job.id}`);
  }

  pollScheduleNotifications(userId) {
    const session = this.sessions.get(userId);
    if (!session || !session.scheduleNotifications) return [];
    const notifs = session.scheduleNotifications.filter(n => !n.read);
    // Mark all as read
    for (const n of notifs) n.read = true;
    return notifs;
  }

  canStartBrowser() {
    return this.activeBrowsers < MAX_CONCURRENT_BROWSERS;
  }

  registerBrowserStart() {
    this.activeBrowsers++;
    console.log(`🌐 Active browsers: ${this.activeBrowsers}/${MAX_CONCURRENT_BROWSERS}`);
  }

  registerBrowserClose() {
    this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);
    console.log(`🌐 Active browsers: ${this.activeBrowsers}/${MAX_CONCURRENT_BROWSERS}`);
  }

  async destroySession(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;
    const shortId = userId.substring(0, 8);
    console.log(`🗑️ Destroying session for ${shortId}...`);
    try {
      if (session.groupWorker?.browser) {
        await session.groupWorker.close();
        this.registerBrowserClose();
      }
      session.scheduler?.stop();
    } catch (e) {
      console.error(`Destroy session error for ${shortId}:`, e.message);
    }
    this.sessions.delete(userId);
  }

  async cleanupInactiveSessions() {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
        if (!session.groupWorker.isRunning && !session.marketplaceWorker.isRunning) {
          const shortId = userId.substring(0, 8);
          console.log(`🧹 Cleaning up inactive session: ${shortId}...`);
          try {
            if (session.groupWorker.browser) {
              await session.groupWorker.close();
              this.registerBrowserClose();
            }
            session.scheduler.stop();
          } catch (e) {
            console.error(`Cleanup error for ${shortId}:`, e.message);
          }
          this.sessions.delete(userId);
        }
      }
    }
  }

  getStats() {
    const presence = this.getPresenceStats();
    return {
      totalSessions: this.sessions.size,
      activeBrowsers: this.activeBrowsers,
      maxBrowsers: MAX_CONCURRENT_BROWSERS,
      ...presence,
      sessions: Array.from(this.sessions.entries()).map(([uid, s]) => ({
        userId: uid.substring(0, 8) + '...',
        isOnline: !!s.lastPresenceAt && (Date.now() - s.lastPresenceAt <= PRESENCE_TIMEOUT_MS),
        isRunning: s.groupWorker.isRunning || s.marketplaceWorker.isRunning,
        hasBrowser: !!(s.groupWorker.browser && s.groupWorker.browser.isConnected()),
        lastActivity: new Date(s.lastActivity).toISOString(),
        lastPresenceAt: s.lastPresenceAt ? new Date(s.lastPresenceAt).toISOString() : null,
      })),
    };
  }

  /**
   * Detailed stats for admin dashboard — includes per-user automation info
   */
  getAdminStats() {
    const now = Date.now();
    let totalAutomationRuns = 0;
    let totalTasksCompleted = 0;
    let totalTasksFailed = 0;
    let totalTasksPending = 0;
    const userDetails = [];

    for (const [uid, session] of this.sessions) {
      const gw = session.groupWorker;
      const mw = session.marketplaceWorker;
      const tracker = session.postingTracker;
      const todayStats = tracker.getTodayStats();

      const isOnline = !!session.lastPresenceAt && (now - session.lastPresenceAt <= PRESENCE_TIMEOUT_MS);
      const isRunningGroup = !!gw.isRunning;
      const isRunningMarketplace = !!mw.isRunning;

      // Count tasks from current/last automation run
      const groupTasks = gw.tasks || [];
      const gwCompleted = groupTasks.filter(t => t.status === 'completed' || t.status === 'pending_approval').length;
      const gwFailed = groupTasks.filter(t => t.status === 'failed').length;
      const gwPending = groupTasks.filter(t => t.status === 'pending' || t.status === 'posting').length;

      totalTasksCompleted += gwCompleted;
      totalTasksFailed += gwFailed;
      totalTasksPending += gwPending;
      totalAutomationRuns += todayStats.automationRuns || 0;

      userDetails.push({
        userId: uid.substring(0, 8) + '...',
        fullUserId: uid,
        email: session.email || null,
        displayName: session.displayName || (session.email ? session.email.split('@')[0] : uid.substring(0, 8)),
        fullName: session.fullName || null,
        lineId: session.lineId || null,
        isOnline,
        isRunningGroup,
        isRunningMarketplace,
        hasBrowser: !!(gw.browser && gw.browser.isConnected()),
        todayPosts: todayStats.postsCount || 0,
        todaySuccess: todayStats.successCount || 0,
        todayFailed: todayStats.failedCount || 0,
        automationRuns: todayStats.automationRuns || 0,
        currentTasks: {
          total: groupTasks.length,
          completed: gwCompleted,
          failed: gwFailed,
          pending: gwPending,
        },
        lastActivity: new Date(session.lastActivity).toISOString(),
      });
    }

    const presence = this.getPresenceStats();

    return {
      totalSessions: this.sessions.size,
      activeBrowsers: this.activeBrowsers,
      maxBrowsers: MAX_CONCURRENT_BROWSERS,
      ...presence,
      automation: {
        totalRunsToday: totalAutomationRuns,
        currentlyRunning: presence.automationUsers,
        totalTasksCompleted,
        totalTasksFailed,
        totalTasksPending,
      },
      users: userDetails,
    };
  }
}

export const sessionManager = new UserSessionManager();
