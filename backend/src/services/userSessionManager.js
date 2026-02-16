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

  touchPresence(userId) {
    const session = this.getSession(userId);
    session.lastPresenceAt = Date.now();
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
    };
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
}

export const sessionManager = new UserSessionManager();
