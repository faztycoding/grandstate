import { Router } from 'express';

/**
 * Analytics, Health Check & Security Score routes
 * - GET /analytics
 * - GET /health-check
 * - GET /security-score
 */
export default function createAnalyticsRoutes({ auth, resolveUserPackage }) {
  const router = Router();

  // Get posting analytics (aggregated from postingTracker)
  router.get('/analytics', ...auth, async (req, res) => {
    try {
      const { days } = req.query;
      // SECURITY: Resolve package from DB instead of trusting frontend
      const userPackage = await resolveUserPackage(req.userId);
      const tracker = req.postingTracker;
      const todayStats = tracker.getTodayStats(userPackage);
      const history = tracker.history || {};
      const archive = history.dailyArchive || {};
      const currentDay = history.currentDay;

      const dailyData = [];
      const now = new Date();
      const numDays = parseInt(days) || 7;

      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        if (dateStr === currentDay) {
          const ts = history.todayStats || {};
          dailyData.push({ date: dateStr, posts: ts.postsCount || 0, success: ts.successCount || 0, failed: ts.failedCount || 0, groups: ts.groupsPosted?.length || 0 });
        } else if (archive[dateStr]) {
          const a = archive[dateStr];
          dailyData.push({ date: dateStr, posts: a.postsCount || 0, success: a.successCount || 0, failed: a.failedCount || 0, groups: a.groupsPosted?.length || 0 });
        } else {
          dailyData.push({ date: dateStr, posts: 0, success: 0, failed: 0, groups: 0 });
        }
      }

      const groupPerformance = [];
      if (history.groupStats) {
        for (const [groupId, stats] of Object.entries(history.groupStats)) {
          groupPerformance.push({
            groupId, groupName: stats.name || stats.groupName || groupId,
            totalPosts: stats.totalPosts || 0, successCount: stats.successCount || 0, failedCount: stats.failedCount || 0,
            lastPosted: stats.lastPosted, successRate: stats.totalPosts > 0 ? Math.round(((stats.successCount || 0) / stats.totalPosts) * 100) : 0,
            propertiesCount: stats.properties?.length || 0,
          });
        }
      }
      groupPerformance.sort((a, b) => b.totalPosts - a.totalPosts);

      const allPostings = history.postings || [];
      const totalPostsAllTime = allPostings.length;
      const totalSuccessAllTime = allPostings.filter(p => p.success).length;
      const totalFailedAllTime = allPostings.filter(p => !p.success).length;

      res.json({
        success: true, today: todayStats, dailyData, groupPerformance: groupPerformance.slice(0, 50),
        summary: { totalPostsAllTime, totalSuccessAllTime, totalFailedAllTime, totalGroupsPosted: groupPerformance.length, avgSuccessRate: totalPostsAllTime > 0 ? Math.round((totalSuccessAllTime / totalPostsAllTime) * 100) : 0 },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Health Check — Real-time risk scoring from actual posting data
  router.get('/health-check', ...auth, (req, res) => {
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

      const todayPostings = postings.filter(p => p.day === todayDate);
      const todayTimestamps = todayPostings.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);
      const postsThisHour = todayTimestamps.filter(t => t > oneHourAgo).length;
      const postsToday = todayPostings.length;

      const delays = [];
      for (let i = 1; i < todayTimestamps.length; i++) {
        delays.push((todayTimestamps[i] - todayTimestamps[i - 1]) / 60000);
      }
      const avgDelay = delays.length > 0 ? delays.reduce((s, v) => s + v, 0) / delays.length : -1;
      const minDelay = delays.length > 0 ? Math.min(...delays) : -1;

      const todayProperties = new Set(todayPostings.map(p => p.propertyId));
      const uniqueProperties = todayProperties.size;
      const diversityRatio = postsToday > 0 ? uniqueProperties / postsToday : 1;

      let intervalCV = -1;
      if (delays.length >= 2) {
        const mean = delays.reduce((s, v) => s + v, 0) / delays.length;
        if (mean > 0) {
          const variance = delays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / delays.length;
          intervalCV = Math.sqrt(variance) / mean;
        } else { intervalCV = 0; }
      }

      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
      let thisWeekCount = 0, lastWeekCount = 0;
      for (const [dateStr, dayData] of Object.entries(archive)) {
        const dt = new Date(dateStr).getTime();
        if (dt > oneWeekAgo) thisWeekCount += (dayData.postsCount || 0);
        else if (dt > twoWeeksAgo) lastWeekCount += (dayData.postsCount || 0);
      }
      thisWeekCount += postsToday;

      let sessionMinutes = 0;
      if (todayTimestamps.length >= 2) {
        sessionMinutes = (todayTimestamps[todayTimestamps.length - 1] - todayTimestamps[0]) / 60000;
      }

      let accountAgeDays = 0;
      if (postings.length > 0) {
        const firstEver = new Date(postings[0].timestamp).getTime();
        accountAgeDays = Math.floor((now - firstEver) / (24 * 60 * 60 * 1000));
      }

      const successToday = todayStats.successCount || 0;
      const failedToday = todayStats.failedCount || 0;
      const successRate = postsToday > 0 ? Math.round((successToday / postsToday) * 100) : 100;
      const automationRuns = todayStats.automationRuns || 0;

      res.json({
        success: true,
        data: {
          postsToday, postsThisHour, postsThisWeek: thisWeekCount, postsLastWeek: lastWeekCount,
          avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 10) / 10 : -1,
          minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 10) / 10 : -1,
          intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
          diversityRatio: Math.round(diversityRatio * 100) / 100, uniqueProperties,
          sessionMinutes: Math.round(sessionMinutes), accountAgeDays, successRate, automationRuns,
          successToday, failedToday, timestamps: todayTimestamps,
        },
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Security Score — Weighted 4-module anti-detection scoring
  router.get('/security-score', ...auth, (req, res) => {
    try {
      const tracker = req.postingTracker;
      tracker.checkDailyReset();
      const history = tracker.history || {};
      const postings = history.postings || [];
      const todayDate = history.currentDay;

      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const todayPostings = postings.filter(p => p.day === todayDate);
      const todayTimestamps = todayPostings.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);
      const postsThisHour = todayTimestamps.filter(t => t > oneHourAgo).length;
      const postsToday = todayPostings.length;

      const delays = [];
      for (let i = 1; i < todayTimestamps.length; i++) {
        delays.push((todayTimestamps[i] - todayTimestamps[i - 1]) / 60000);
      }
      const avgDelay = delays.length > 0 ? delays.reduce((s, v) => s + v, 0) / delays.length : -1;
      const minDelay = delays.length > 0 ? Math.min(...delays) : -1;

      let intervalCV = -1;
      if (delays.length >= 2) {
        const mean = delays.reduce((s, v) => s + v, 0) / delays.length;
        if (mean > 0) {
          const variance = delays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / delays.length;
          intervalCV = Math.sqrt(variance) / mean;
        }
      }

      const todayProperties = new Set(todayPostings.map(p => p.propertyId));
      const diversityRatio = postsToday > 0 ? todayProperties.size / postsToday : 1;

      let accountAgeDays = 0;
      if (postings.length > 0) {
        const firstEver = new Date(postings[0].timestamp).getTime();
        accountAgeDays = Math.floor((now - firstEver) / (24 * 60 * 60 * 1000));
      }

      import('../services/antiDetection.js').then(({ calculateSecurityScore }) => {
        const result = calculateSecurityScore({
          postsToday, postsThisHour,
          avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 100) / 100 : -1,
          minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 100) / 100 : -1,
          intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
          accountAgeDays, fingerprintActive: true, webrtcBlocked: true,
          warmupDone: req.session?.warmupDone || false, imagesMutated: true, captionsAI: true,
          diversityRatio: Math.round(diversityRatio * 100) / 100,
          postingHour: new Date().getHours(), isResidentialProxy: false,
        });

        res.json({
          success: true, ...result,
          raw: {
            postsToday, postsThisHour,
            avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 10) / 10 : -1,
            minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 10) / 10 : -1,
            intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
            accountAgeDays, diversityRatio: Math.round(diversityRatio * 100) / 100,
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

  return router;
}
