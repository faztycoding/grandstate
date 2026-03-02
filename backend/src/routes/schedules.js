import { Router } from 'express';

/**
 * Scheduled Posting routes
 * - GET  /schedules
 * - GET  /schedules/notifications
 * - POST /schedules
 * - POST /schedules/:id/cancel
 * - DELETE /schedules/:id
 */
export default function createScheduleRoutes({ auth, sessionManager, resolveUserPackage }) {
  const router = Router();

  // Get all schedules
  router.get('/schedules', ...auth, (req, res) => {
    res.json({ success: true, schedules: req.scheduler.getSchedules() });
  });

  // Poll schedule notifications (consumed on read) — must be before :id routes
  router.get('/schedules/notifications', ...auth, (req, res) => {
    const notifications = sessionManager.pollScheduleNotifications(req.userId);
    res.json({ success: true, notifications });
  });

  // Create a new scheduled post
  router.post('/schedules', ...auth, async (req, res) => {
    try {
      const { scheduledAt, mode, property, groups, caption, images, delaySeconds, captionStyle, browser, fbSlot, fbAccountName } = req.body;
      if (!scheduledAt || !mode || !property || !groups?.length) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // SECURITY: Resolve package from DB instead of trusting frontend
      const userPackage = await resolveUserPackage(req.userId);

      const slotToUse = fbSlot ?? sessionManager.getActiveSlot(req.userId);
      const hasCredentials = sessionManager.hasFbCredentials(req.userId, slotToUse);

      const schedule = req.scheduler.addSchedule({
        scheduledAt, mode, property, groups, caption, images, delaySeconds, captionStyle, userPackage, browser,
        fbSlot: slotToUse,
        fbAccountName: fbAccountName || null,
      });

      res.json({
        success: true, schedule, hasCredentials,
        warning: !hasCredentials ? 'ไม่พบข้อมูล Login สำหรับ slot นี้ — หากถึงเวลาแล้ว session หมดอายุ อาจไม่สามารถ re-login ได้อัตโนมัติ กรุณา Login Facebook ก่อนตั้งเวลา' : null,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Cancel a scheduled post
  router.post('/schedules/:id/cancel', ...auth, (req, res) => {
    const ok = req.scheduler.cancelSchedule(req.params.id);
    res.json({ success: ok, message: ok ? 'Cancelled' : 'Not found or already running' });
  });

  // Delete a scheduled post
  router.delete('/schedules/:id', ...auth, (req, res) => {
    const ok = req.scheduler.deleteSchedule(req.params.id);
    res.json({ success: ok });
  });

  return router;
}
