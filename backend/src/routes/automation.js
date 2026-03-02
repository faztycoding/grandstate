import { Router } from 'express';

/**
 * Group & Marketplace Automation routes
 * - POST /group-automation/start
 * - GET  /group-automation/status
 * - GET  /group-automation/queue-status
 * - POST /group-automation/cancel-queue
 * - POST /group-automation/pause
 * - POST /group-automation/resume
 * - POST /group-automation/stop
 * - POST /group-automation/close
 * - POST /group-automation/init
 * - GET  /group-automation/check-login
 * - POST /group-automation/generate-caption
 * - POST /marketplace-automation/start
 * - GET  /marketplace-automation/status
 * - POST /marketplace-automation/pause
 * - POST /marketplace-automation/resume
 * - POST /marketplace-automation/stop
 */
export default function createAutomationRoutes({ auth, sessionManager, automationQueue, validateBody, resolveUserPackage }) {
  const router = Router();

  // ====================================
  // Group Posting Automation
  // ====================================

  // Start group posting automation (with queue system)
  router.post('/group-automation/start', ...auth, async (req, res) => {
    try {
      const { property, groups, images, delayMinutes, delaySeconds, claudeApiKey, browser, fbSlot } = req.body;

      // Validate required inputs
      const vErrors = validateBody(req.body, {
        property: { required: true, type: 'object' },
        groups: { required: true, isArray: true, maxItems: 750 },
      });
      if (vErrors) return res.status(400).json({ success: false, error: vErrors.join(', ') });

      // SECURITY: Resolve actual package from DB, never trust frontend
      const userPackage = await resolveUserPackage(req.userId);

      // Switch to the correct FB session slot if specified
      if (typeof fbSlot === 'number' && fbSlot >= 0) {
        req.groupWorker.setProfileSlot(fbSlot);
        sessionManager.setActiveSlot(req.userId, fbSlot);
        console.log(`🔗 [Automation] Using FB session slot ${fbSlot}`);
      }

      if (groups.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one group is required' });
      }

      // Validate post limit based on verified package
      const packageLimits = { free: 10, agent: 300, elite: 750 };
      const limit = packageLimits[userPackage] || 10;
      if (groups.length > limit) {
        return res.status(400).json({
          success: false, error: `Package ${userPackage} limit exceeded`,
          message: `แพ็กเกจ ${userPackage.toUpperCase()} จำกัด ${limit} โพสต์/วัน คุณเลือก ${groups.length} กลุ่ม`
        });
      }

      // Initialize Claude API if key provided
      if (claudeApiKey) req.groupWorker.initAnthropicClient(claudeApiKey);

      // Auto-generate captions based on group count
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
        } catch (err) { console.error(`Caption gen ${i + 1} failed:`, err.message); }
      }
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
        property, groups, caption: generatedCaptions[0], captions: generatedCaptions, captionAssignments,
        images: images || property.images || [], delayMinutes: delayMinutes || undefined, delaySeconds: delaySeconds || undefined,
        captionStyle, browser: browser || 'chrome', userPackage: userPackage || 'free',
      };

      // Use queue system
      const groupWorker = req.groupWorker;
      const session = sessionManager.getSession(req.userId);
      const displayName = session?.displayName || session?.email?.split('@')[0] || req.userId.substring(0, 8);
      const activeSlot = session?.activeSlot || 0;
      const fbSession = session?.fbSessions?.[activeSlot];
      const fbAccount = fbSession?.name || null;

      const queueResult = await automationQueue.tryStartOrEnqueue(
        req.userId, (cfg) => groupWorker.startAutomation(cfg), automationConfig,
        { worker: groupWorker, displayName, email: session?.email || null, fbAccount, propertyTitle: property?.title || null, automationType: 'group' }
      );

      if (queueResult.queued) {
        console.log(`📋 User ${req.userId.substring(0, 8)} queued at position ${queueResult.position}`);
        return res.json({
          success: true, queued: true, position: queueResult.position, estimatedWaitSec: queueResult.estimatedWaitSec,
          message: `คิวที่ ${queueResult.position} — รอประมาณ ${Math.ceil(queueResult.estimatedWaitSec / 60)} นาที`,
          totalGroups: groups.length, generatedCaptions,
        });
      }

      await new Promise(r => setTimeout(r, 200));
      const status = groupWorker.getStatus();

      res.json({
        success: true, queued: false, message: `เริ่ม automation แล้ว — ${groups.length} กลุ่ม`,
        totalGroups: groups.length, generatedCaptions,
        isRunning: status.isRunning, isPaused: status.isPaused, currentStep: status.currentStep,
        totalSteps: status.totalSteps, tasks: status.tasks, logs: status.logs,
        startTime: status.startTime, endTime: status.endTime,
      });
    } catch (error) {
      console.error('Group automation start error:', error);
      const isAlreadyRunning = error.message?.includes('Automation') && error.message?.includes('กำลังทำงาน');
      const statusCode = isAlreadyRunning ? 409 : 500;
      res.status(statusCode).json({ success: false, error: error.message, errorType: isAlreadyRunning ? 'already_running' : 'server_error' });
    }
  });

  // Get automation status
  router.get('/group-automation/status', ...auth, (req, res) => {
    try {
      const status = req.groupWorker.getStatus();
      const queueStatus = automationQueue.getUserQueueStatus(req.userId);
      res.json({ success: true, ...status, queue: queueStatus });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Queue status for this user
  router.get('/group-automation/queue-status', ...auth, (req, res) => {
    try {
      const queueStatus = automationQueue.getUserQueueStatus(req.userId);
      const workerStatus = req.groupWorker.getStatus();
      res.json({ success: true, ...queueStatus, isRunning: workerStatus.isRunning });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Cancel queue position
  router.post('/group-automation/cancel-queue', ...auth, (req, res) => {
    try {
      const removed = automationQueue.cancelQueue(req.userId);
      res.json({ success: true, removed, message: removed ? 'ออกจากคิวแล้ว' : 'ไม่ได้อยู่ในคิว' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Pause automation
  router.post('/group-automation/pause', ...auth, (req, res) => {
    try { req.groupWorker.pause(); res.json({ success: true, message: 'Automation paused' }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Resume automation
  router.post('/group-automation/resume', ...auth, (req, res) => {
    try { req.groupWorker.resume(); res.json({ success: true, message: 'Automation resumed' }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Stop automation
  router.post('/group-automation/stop', ...auth, async (req, res) => {
    try {
      const wasQueued = automationQueue.cancelQueue(req.userId);
      const hadBrowser = !!(req.groupWorker.browser && req.groupWorker.browser.isConnected());
      await req.groupWorker.stop();
      if (hadBrowser) sessionManager.registerBrowserClose();
      if (!wasQueued) automationQueue._onJobComplete(req.userId, false);
      res.json({ success: true, message: 'Automation stopped' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Close browser
  router.post('/group-automation/close', ...auth, async (req, res) => {
    try {
      const hadBrowser = !!(req.groupWorker.browser && req.groupWorker.browser.isConnected());
      await req.groupWorker.close();
      if (hadBrowser) sessionManager.registerBrowserClose();
      res.json({ success: true, message: 'Browser closed' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Initialize browser (for pre-login)
  router.post('/group-automation/init', ...auth, async (req, res) => {
    try {
      await req.groupWorker.initialize();
      res.json({ success: true, message: 'Browser initialized - Please login to Facebook' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Check login status
  router.get('/group-automation/check-login', ...auth, async (req, res) => {
    try {
      if (!req.groupWorker.browser) await req.groupWorker.initialize();
      const isLoggedIn = await req.groupWorker.checkLogin();
      res.json({ success: true, isLoggedIn });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Generate caption using Claude API
  router.post('/group-automation/generate-caption', ...auth, async (req, res) => {
    try {
      const { property, style, claudeApiKey, requiredCaptions = 1 } = req.body;
      if (claudeApiKey) req.groupWorker.initAnthropicClient(claudeApiKey);

      // SECURITY: Resolve package from DB + cap captions to 5
      const userPackage = await resolveUserPackage(req.userId);
      const cappedCaptions = Math.min(Math.max(1, requiredCaptions), 5);

      console.log(`📝 Generate caption request - Package: ${userPackage}, Required: ${cappedCaptions}`);
      const allCaptions = [];
      for (let i = 0; i < cappedCaptions; i++) {
        const caption = await req.groupWorker.generateCaption(property, style || 'friendly', userPackage);
        allCaptions.push(caption);
      }
      const fullResponse = allCaptions.join('\n\n---\n\n');
      res.json({ success: true, caption: fullResponse, captions: allCaptions, package: userPackage, captionCount: allCaptions.length, requiredCaptions: cappedCaptions });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // ====================================
  // Marketplace Posting Automation
  // ====================================

  // Start marketplace automation
  router.post('/marketplace-automation/start', ...auth, async (req, res) => {
    try {
      const { property, groups, caption, images, delayMinutes, delaySeconds, captionStyle, claudeApiKey, browser } = req.body;

      if (!property) return res.status(400).json({ success: false, error: 'Property is required' });
      if (!groups || groups.length === 0) return res.status(400).json({ success: false, error: 'At least one group is required' });

      // SECURITY: Resolve actual package from DB
      const userPackage = await resolveUserPackage(req.userId);

      const packageLimits = { free: 10, agent: 300, elite: 750 };
      const limit = packageLimits[userPackage] || 10;
      if (groups.length > limit) {
        return res.status(400).json({ success: false, error: `Package ${userPackage} limit exceeded`, message: `แพ็กเกจ ${userPackage.toUpperCase()} จำกัด ${limit} โพสต์/วัน คุณเลือก ${groups.length} กลุ่ม` });
      }

      if (req.groupWorker.browser && req.groupWorker.browser.isConnected()) {
        console.log('🔗 Marketplace borrowing browser from req.groupWorker...');
        req.marketplaceWorker.borrowBrowser(req.groupWorker.browser, req.groupWorker.page);
      }

      const tracker = req.marketplaceWorker.tracker;
      const preflight = tracker.preflightCheck(property.id, groups.map(g => g.id), userPackage || 'free');

      if (!preflight.canProceed) {
        const reason = preflight.dailyRemaining === 0
          ? `ถึงลิมิตวันนี้แล้ว (${preflight.dailyLimit} โพสต์) รีเซ็ตตี 5`
          : `กลุ่มทั้งหมดถูกโพสต์ไปแล้ววันนี้`;
        return res.json({ success: false, error: reason, errorType: 'limit_reached', tasks: [], dailyStats: tracker.getTodayStats(userPackage || 'free') });
      }

      const session = sessionManager.getSession(req.userId);
      const displayName = session?.displayName || session?.email?.split('@')[0] || req.userId.substring(0, 8);
      const mktActiveSlot = session?.activeSlot || 0;
      const mktFbSession = session?.fbSessions?.[mktActiveSlot];
      const mktFbAccount = mktFbSession?.name || null;

      const automationConfig = {
        property, groups: preflight.canPost, caption, images: images || property.images || [],
        delayMinutes: delayMinutes || undefined, delaySeconds: delaySeconds || undefined,
        captionStyle: captionStyle || 'friendly', browser: browser || 'chrome', userPackage: userPackage || 'free', claudeApiKey,
      };

      const queueResult = await automationQueue.tryStartOrEnqueue(
        req.userId, (cfg) => req.marketplaceWorker.startMarketplaceAutomation(cfg), automationConfig,
        { worker: req.marketplaceWorker, displayName, email: session?.email || null, fbAccount: mktFbAccount, propertyTitle: property?.title || null, automationType: 'marketplace' }
      );

      if (queueResult.queued) {
        console.log(`📋 User ${req.userId.substring(0, 8)} queued at position ${queueResult.position}`);
        return res.json({
          success: true, queued: true, position: queueResult.position, estimatedWaitSec: queueResult.estimatedWaitSec,
          message: `คิวที่ ${queueResult.position} — รอประมาณ ${Math.ceil(queueResult.estimatedWaitSec / 60)} นาที`,
          skippedDuplicate: preflight.skippedDuplicate.length, skippedOverLimit: preflight.skippedOverLimit.length, totalGroups: preflight.canPost.length,
        });
      }

      await new Promise(r => setTimeout(r, 200));
      const status = req.marketplaceWorker.getStatus();

      res.json({
        success: true, message: `เริ่ม automation แล้ว — ${preflight.canPost.length} กลุ่ม (${Math.ceil(preflight.canPost.length / 20)} batches)`,
        skippedDuplicate: preflight.skippedDuplicate.length, skippedOverLimit: preflight.skippedOverLimit.length, totalGroups: preflight.canPost.length,
        isRunning: status.isRunning, isPaused: status.isPaused, currentStep: status.currentStep, totalSteps: status.totalSteps,
        tasks: status.tasks, logs: status.logs, startTime: status.startTime, endTime: status.endTime, generatedCaptions: status.generatedCaptions,
      });
    } catch (error) {
      console.error('Marketplace automation start error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Marketplace status
  router.get('/marketplace-automation/status', ...auth, (req, res) => {
    try { const status = req.marketplaceWorker.getStatus(); res.json({ success: true, ...status }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Pause marketplace
  router.post('/marketplace-automation/pause', ...auth, (req, res) => {
    try { req.marketplaceWorker.pause(); res.json({ success: true, message: 'Marketplace automation paused' }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Resume marketplace
  router.post('/marketplace-automation/resume', ...auth, (req, res) => {
    try { req.marketplaceWorker.resume(); res.json({ success: true, message: 'Marketplace automation resumed' }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Stop marketplace
  router.post('/marketplace-automation/stop', ...auth, async (req, res) => {
    try {
      const wasQueued = automationQueue.cancelQueue(req.userId);
      await req.marketplaceWorker.stop();
      if (!wasQueued) automationQueue._onJobComplete(req.userId, false);
      res.json({ success: true, message: 'Marketplace automation stopped' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  return router;
}
