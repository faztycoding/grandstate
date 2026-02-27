import { GroupPostingWorker } from './groupPostingWorker.js';
import { MarketplaceWorker } from './marketplaceWorker.js';
import { PostingTracker } from './postingTracker.js';
import { PostScheduler } from './scheduler.js';

const MAX_CONCURRENT_BROWSERS = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity
const PRESENCE_TIMEOUT_MS = 45 * 1000; // 45s without heartbeat = offline

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
      if (userMeta.display_name || userMeta.full_name) session.displayName = userMeta.display_name || userMeta.full_name;
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

  getPresenceStats() {
    const now = Date.now();
    let activeUsers = 0;
    let onlineUsers = 0;
    let automationUsers = 0;

    for (const [, session] of this.sessions) {
      const hasLivePresence = !!session.lastPresenceAt && (now - session.lastPresenceAt <= PRESENCE_TIMEOUT_MS);
      const hasRunningAutomation = !!(session.groupWorker.isRunning || session.marketplaceWorker.isRunning);

      if (hasLivePresence) onlineUsers++;
      if (hasRunningAutomation) automationUsers++;
      if (hasLivePresence || hasRunningAutomation) activeUsers++;
    }

    return {
      activeUsers,
      onlineUsers,
      automationUsers,
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

    // Start scheduler
    scheduler.start(async (job) => {
      console.log(`⏰ [${shortId}] Scheduler: ${job.mode} for ${job.groups?.length} groups`);
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
      fbSessions: [],
      activeSlot: 0, // which slot the groupWorker is currently using
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
  }

  clearFbSession(userId, slot) {
    const session = this.getSession(userId);
    session.fbSessions[slot] = null;
  }

  getActiveSlot(userId) {
    const session = this.getSession(userId);
    return session.activeSlot || 0;
  }

  setActiveSlot(userId, slot) {
    const session = this.getSession(userId);
    session.activeSlot = slot;
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
