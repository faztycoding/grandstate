import { Router } from 'express';

/**
 * Posting Tracker routes
 * - GET  /posting/today
 * - POST /posting/preflight
 * - GET  /posting/history
 * - GET  /posting-history
 * - GET  /posting-history/:propertyId
 * - GET  /available-groups/:propertyId
 */
export default function createPostingRoutes({ auth }) {
  const router = Router();

  // Today's stats (daily usage, limit, next reset)
  router.get('/posting/today', ...auth, (req, res) => {
    const { userPackage } = req.query;
    res.json({ success: true, ...req.postingTracker.getTodayStats(userPackage || 'free') });
  });

  // Pre-flight check before starting automation
  router.post('/posting/preflight', ...auth, (req, res) => {
    const { propertyId, groupIds, userPackage } = req.body;
    if (!propertyId || !groupIds) {
      return res.status(400).json({ success: false, error: 'propertyId and groupIds required' });
    }
    const result = req.postingTracker.preflightCheck(propertyId, groupIds, userPackage || 'free');
    res.json({ success: true, ...result });
  });

  // Daily history (last N days)
  router.get('/posting/history', ...auth, (req, res) => {
    const { days } = req.query;
    res.json({ success: true, days: req.postingTracker.getDailyHistory(parseInt(days) || 7) });
  });

  // Full posting history
  router.get('/posting-history', ...auth, (req, res) => {
    res.json({ success: true, history: req.postingTracker.getHistory() });
  });

  // Property-specific posting history
  router.get('/posting-history/:propertyId', ...auth, (req, res) => {
    const { propertyId } = req.params;
    res.json({ success: true, history: req.postingTracker.getPropertyHistory(propertyId) });
  });

  // Available groups (not yet posted today)
  router.get('/available-groups/:propertyId', ...auth, (req, res) => {
    const { propertyId } = req.params;
    const { groupIds, cooldownHours } = req.query;
    const allGroupIds = groupIds ? groupIds.split(',') : [];
    const available = req.postingTracker.filterAvailableGroups(propertyId, allGroupIds, parseInt(cooldownHours) || 24);
    res.json({ success: true, availableGroups: available });
  });

  // Reset all posting analytics data
  router.post('/analytics/reset', ...auth, (req, res) => {
    try {
      req.postingTracker.resetAll();
      console.log('✅ Analytics data reset via API');
      res.json({ success: true, message: 'All analytics data reset' });
    } catch (error) {
      console.error('❌ Reset failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
