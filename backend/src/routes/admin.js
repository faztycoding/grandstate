import { Router } from 'express';

/**
 * Admin routes — all require adminAuth middleware
 * - GET  /admin/stats
 * - GET  /admin/stats/stream
 * - GET  /debug/my-data
 * - GET  /admin/all-users
 * - GET  /admin/license-activations
 * - POST /admin/ban-user
 * - POST /admin/delete-user
 * - POST /admin/change-package
 * - POST /admin/delete-license
 * - GET  /admin/user-licenses
 * - POST /admin/clear-history
 * - GET  /admin/export-history
 * - POST /admin/clear-stale-sessions
 * - GET  /admin/queue
 * - POST /admin/force-stop
 * - GET  /worker-slots
 */
export default function createAdminRoutes({ adminAuth, auth, sessionManager, automationQueue }) {
  const router = Router();

  // Admin stats — detailed active users + automation + queue info
  router.get('/admin/stats', ...adminAuth, (req, res) => {
    try {
      const adminStats = sessionManager.getAdminStats();
      const queueStats = automationQueue.getQueueStats();
      res.json({ success: true, ...adminStats, queue: queueStats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin stats SSE stream — Real-time updates
  router.get('/admin/stats/stream', ...adminAuth, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
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
    sendStats();
    const intervalId = setInterval(sendStats, 1000);
    req.on('close', () => { clearInterval(intervalId); });
  });

  // Debug: check user data in DB (admin-only)
  router.get('/debug/my-data', ...adminAuth, async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);

      const { data: groups, error: gErr } = await supa.from('facebook_groups').select('id, user_id, name, created_at').eq('user_id', req.userId);
      const { data: props, error: pErr } = await supa.from('properties').select('id, user_id, title, created_at').eq('user_id', req.userId);
      const { data: allGroups } = await supa.from('facebook_groups').select('id, user_id, name').limit(20);
      const { data: allProps } = await supa.from('properties').select('id, user_id, title').limit(20);

      res.json({
        success: true, userId: req.userId,
        myGroups: { count: groups?.length || 0, data: groups, error: gErr?.message },
        myProperties: { count: props?.length || 0, data: props, error: pErr?.message },
        allGroups: { count: allGroups?.length || 0, data: allGroups },
        allProperties: { count: allProps?.length || 0, data: allProps },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: full queue stats
  router.get('/admin/queue', ...adminAuth, (req, res) => {
    try {
      res.json({ success: true, ...automationQueue.getQueueStats() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: force-stop a specific user's automation
  router.post('/admin/force-stop', ...adminAuth, async (req, res) => {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId is required' });

      const targetSession = sessionManager.sessions.get(targetUserId);
      if (!targetSession) return res.status(404).json({ success: false, error: 'User session not found' });

      const results = [];
      const wasQueued = automationQueue.cancelQueue(targetUserId);
      if (wasQueued) results.push('Removed from queue');

      if (targetSession.groupWorker.isRunning) {
        try { await targetSession.groupWorker.stop(); results.push('Group automation stopped'); }
        catch (e) { results.push(`Group stop error: ${e.message}`); }
      }
      if (targetSession.marketplaceWorker.isRunning) {
        try { await targetSession.marketplaceWorker.stop(); results.push('Marketplace automation stopped'); }
        catch (e) { results.push(`Marketplace stop error: ${e.message}`); }
      }
      if (!wasQueued) automationQueue._onJobComplete(targetUserId, false);

      const shortId = targetUserId.substring(0, 8);
      console.log(`🛑 [Admin] Force-stopped user ${shortId}: ${results.join(', ') || 'No running automation'}`);
      res.json({ success: true, message: results.length > 0 ? results.join('; ') : 'No active automation to stop', results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: get ALL registered users from Supabase Auth
  router.get('/admin/all-users', ...adminAuth, async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

      const { data: { users }, error } = await supa.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const displayIdMap = new Map();
      try {
        const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?select=id,display_id`, {
          headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
        });
        if (resp.ok) { const rows = await resp.json(); for (const r of rows) { if (r.display_id) displayIdMap.set(r.id, r.display_id); } }
      } catch (e) { console.log('⚠️ Could not fetch display_ids:', e.message); }

      const adminStats = sessionManager.getAdminStats();
      const liveUserMap = new Map();
      for (const u of adminStats.users) { if (u.fullUserId) liveUserMap.set(u.fullUserId, u); }

      const merged = (users || []).map(u => {
        const live = liveUserMap.get(u.id);
        const meta = u.user_metadata || {};
        return {
          userId: u.id.substring(0, 8) + '...', fullUserId: u.id,
          displayId: displayIdMap.get(u.id) || null, email: u.email || null,
          displayName: meta.display_name || meta.full_name || (u.email ? u.email.split('@')[0] : u.id.substring(0, 8)),
          fullName: meta.full_name || null, lineId: meta.line_id || null,
          createdAt: u.created_at, lastSignIn: u.last_sign_in_at,
          banned: !!u.banned_until || !!meta.banned,
          isOnline: live?.isOnline || false, isRunningGroup: live?.isRunningGroup || false,
          isRunningMarketplace: live?.isRunningMarketplace || false, hasBrowser: live?.hasBrowser || false,
          todayPosts: live?.todayPosts || 0, todaySuccess: live?.todaySuccess || 0,
          todayFailed: live?.todayFailed || 0, automationRuns: live?.automationRuns || 0,
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

  // Admin: get license activation details
  router.get('/admin/license-activations', ...adminAuth, async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
      const { data, error } = await supa.from('device_activations').select('*, license_keys(license_key, package, owner_name)').order('activated_at', { ascending: false });
      if (error) throw error;
      res.json({ success: true, activations: data || [] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: ban/unban a user
  router.post('/admin/ban-user', ...adminAuth, async (req, res) => {
    try {
      const { targetUserId, banned } = req.body;
      if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });

      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

      const { error } = await supa.auth.admin.updateUserById(targetUserId, {
        user_metadata: { banned: !!banned },
        ...(banned ? { ban_duration: '876000h' } : { ban_duration: 'none' }),
      });
      if (error) throw error;

      if (banned) {
        const session = sessionManager.getSession(targetUserId);
        if (session?.groupWorker?.isRunning) { await session.groupWorker.stop(); automationQueue._onJobComplete(targetUserId, false); }
        if (session?.marketplaceWorker?.isRunning) { await session.marketplaceWorker.stop(); }
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
  router.post('/admin/delete-user', ...adminAuth, async (req, res) => {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });

      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      if (!serviceKey) return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_KEY not configured — ตั้งค่าใน backend/.env ก่อน' });

      const supaUrl = process.env.SUPABASE_URL;
      const shortId = targetUserId.substring(0, 8);
      console.log(`🗑️ [Admin] Starting delete for user ${shortId}...`);

      const session = sessionManager.getSession(targetUserId);
      if (session?.groupWorker?.isRunning) { await session.groupWorker.stop(); automationQueue._onJobComplete(targetUserId, false); }
      if (session?.marketplaceWorker?.isRunning) { await session.marketplaceWorker.stop(); }

      const tables = ['facebook_groups', 'properties', 'license_keys'];
      const deleted = {};
      for (const table of tables) {
        try {
          const resp = await fetch(`${supaUrl}/rest/v1/${table}?user_id=eq.${targetUserId}`, {
            method: 'DELETE',
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          });
          if (resp.ok) { const rows = await resp.json(); deleted[table] = Array.isArray(rows) ? rows.length : 0; }
          else { const errText = await resp.text(); console.log(`   ⚠️ Delete ${table}: ${resp.status} ${errText}`); deleted[table] = 0; }
        } catch (e) { console.log(`   ⚠️ Delete ${table}: ${e.message}`); deleted[table] = 0; }
      }

      try {
        await fetch(`${supaUrl}/rest/v1/users?id=eq.${targetUserId}`, {
          method: 'DELETE', headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        });
      } catch (e) { console.log(`   ⚠️ Delete users table: ${e.message}`); }

      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(supaUrl, serviceKey);
      const { error: authErr } = await supa.auth.admin.deleteUser(targetUserId);
      if (authErr) {
        if (authErr.message?.includes('not found') || authErr.message?.includes('User not found')) {
          console.log(`   ℹ️ Auth user already deleted or not found`);
        } else { throw authErr; }
      }

      sessionManager.destroySession?.(targetUserId);

      console.log(`🗑️ [Admin] User ${shortId} DELETED — groups:${deleted.facebook_groups}, properties:${deleted.properties}, licenses:${deleted.license_keys}`);
      res.json({ success: true, message: `ลบผู้ใช้ ${shortId} สำเร็จ — กลุ่ม:${deleted.facebook_groups}, ทรัพย์สิน:${deleted.properties}`, deleted });
    } catch (error) {
      console.error('Delete user error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: change user package
  router.post('/admin/change-package', ...adminAuth, async (req, res) => {
    try {
      const { targetUserId, newPackage } = req.body;
      if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });
      if (!['free', 'agent', 'elite'].includes(newPackage)) return res.status(400).json({ success: false, error: 'Invalid package' });

      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

      if (newPackage === 'free') {
        const { error } = await supa.from('license_keys').update({ is_active: false }).eq('bound_user_id', targetUserId);
        if (error) throw error;
        res.json({ success: true, package: 'free', message: 'Downgraded to Free (license deactivated)' });
      } else {
        const { data: existing } = await supa.from('license_keys').select('*').eq('bound_user_id', targetUserId).eq('is_active', true).limit(1).maybeSingle();

        if (existing) {
          const { error } = await supa.from('license_keys').update({ package: newPackage }).eq('id', existing.id);
          if (error) throw error;
          res.json({ success: true, package: newPackage, message: `Updated license to ${newPackage}` });
        } else {
          const key = `GSADM-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          const expiresAt = new Date();
          const durationDays = req.body.durationDays || 365;
          expiresAt.setDate(expiresAt.getDate() + durationDays);

          let ownerName = req.body.displayName || null;
          if (!ownerName) {
            try {
              const { data: authUser } = await supa.auth.admin.getUserById(targetUserId);
              ownerName = authUser?.user?.user_metadata?.display_name || authUser?.user?.user_metadata?.full_name || authUser?.user?.email?.split('@')[0] || null;
            } catch { /* fallback */ }
          }

          const { error } = await supa.from('license_keys').insert({
            license_key: key, package: newPackage, max_devices: 1, expires_at: expiresAt.toISOString(),
            is_active: true, bound_user_id: targetUserId, owner_name: ownerName || `User ${targetUserId.substring(0, 8)}`,
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

  // Admin: delete a license key
  router.post('/admin/delete-license', ...adminAuth, async (req, res) => {
    try {
      const { licenseId } = req.body;
      if (!licenseId) return res.status(400).json({ success: false, error: 'licenseId required' });

      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      await supa.from('device_activations').delete().eq('license_key_id', licenseId);
      const { data, error } = await supa.from('license_keys').delete().eq('id', licenseId).select();
      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).json({ success: false, error: 'License not found' });

      console.log(`🗑️ [Admin] License ${licenseId} deleted by ${req.userEmail}`);
      res.json({ success: true, deleted: data[0] });
    } catch (error) {
      console.error('Delete license error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: get license info for all users
  router.get('/admin/user-licenses', ...adminAuth, async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const { data, error } = await supa.from('license_keys').select('bound_user_id, license_key, package, expires_at, is_active, owner_name, created_at').not('bound_user_id', 'is', null).order('created_at', { ascending: false });
      if (error) throw error;

      const byUser = {};
      for (const row of (data || [])) {
        const uid = row.bound_user_id;
        if (!byUser[uid] || (row.is_active && !byUser[uid].is_active)) { byUser[uid] = row; }
      }
      res.json({ success: true, licenses: byUser });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: clear job history
  router.post('/admin/clear-history', ...adminAuth, (req, res) => {
    try {
      const { type = 'all' } = req.body;
      if (!['all', 'success', 'failed'].includes(type)) return res.status(400).json({ success: false, error: 'type must be all | success | failed' });
      const removed = automationQueue.clearHistory(type);
      console.log(`🗑️ Admin cleared ${removed} history records (type=${type})`);
      res.json({ success: true, removed, message: `ลบประวัติ ${removed} รายการ (${type})` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: export job history as JSON
  router.get('/admin/export-history', ...adminAuth, (req, res) => {
    try {
      const stats = automationQueue.getQueueStats();
      const allHistory = stats.recentHistory || [];
      res.json({ success: true, history: allHistory, exportedAt: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin: manually trigger ghost/stale session cleanup
  router.post('/admin/clear-stale-sessions', ...adminAuth, (req, res) => {
    try {
      const before = automationQueue.running.size;
      automationQueue._cleanupStaleEntries();
      const after = automationQueue.running.size;
      const cleared = before - after;
      const queueBefore = automationQueue.queue.length;
      const queueCleared = queueBefore - automationQueue.queue.length;
      res.json({ success: true, message: `ล้าง ghost sessions ${cleared} รายการ, queue ${queueCleared} รายการ`, cleared, queueCleared });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Worker Slots — Real-time node status for factory monitor
  router.get('/worker-slots', ...adminAuth, (req, res) => {
    try {
      const stats = automationQueue.getQueueStats();
      const maxSlots = stats.maxConcurrent || 10;

      const slots = [];
      const runningEntries = stats.running || [];
      const queueEntries = stats.queue || [];

      for (let i = 0; i < maxSlots; i++) {
        const slotNum = String(i + 1).padStart(3, '0');
        if (i < runningEntries.length) {
          const job = runningEntries[i];
          const worker = automationQueue.running.get(job.fullUserId)?.worker;
          const workerStatus = worker && typeof worker.getStatus === 'function' ? worker.getStatus() : null;

          let logs = [];
          if (workerStatus && Array.isArray(workerStatus.logs)) {
            logs = workerStatus.logs.slice(-50).map(l => ({ time: l.time, msg: l.msg, level: l.level || 'info' }));
          }

          const tasks = workerStatus?.tasks || [];
          const completed = tasks.filter(t => t.status === 'completed' || t.status === 'pending_approval').length;
          const failed = tasks.filter(t => t.status === 'failed').length;
          const total = workerStatus?.totalSteps || tasks.length;

          slots.push({
            slotId: slotNum, status: workerStatus?.isPaused ? 'paused' : 'running',
            userId: job.userId, fullUserId: job.fullUserId,
            displayName: job.displayName || 'User', fbAccount: job.fbAccount || null,
            propertyTitle: job.propertyTitle || null, automationType: job.automationType || 'group',
            groupCount: job.groupCount, startedAt: job.startedAt, runningSec: job.runningSec,
            progress: { completed, failed, total, percent: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0 },
            logs, generatedCaptions: workerStatus?.generatedCaptions || [],
          });
        } else {
          slots.push({
            slotId: slotNum, status: 'standby', userId: null, displayName: null,
            fbAccount: null, propertyTitle: null, automationType: null,
            groupCount: 0, startedAt: null, runningSec: 0,
            progress: { completed: 0, failed: 0, total: 0, percent: 0 },
            logs: [], generatedCaptions: [],
          });
        }
      }

      const waiting = queueEntries.map(q => ({
        userId: q.userId, displayName: q.displayName, groupCount: q.groupCount,
        waitingSec: q.waitingSec, automationType: q.automationType,
      }));

      let aggregatedAntiDetection = {
        gaussianJitter: { status: 'OFF', active: false }, fingerprintMasking: { status: 'OFF', active: false },
        webrtcShield: { status: 'OFF', active: false }, behaviorSimulation: { status: 'OFF', active: false },
        canvasNoise: { status: 'OFF', active: false }, networkStealth: { status: 'OFF', active: false },
      };
      for (const [uid, job] of automationQueue.running.entries()) {
        const worker = job.worker;
        if (worker && typeof worker.getAntiDetectionStatus === 'function') {
          const ad = worker.getAntiDetectionStatus();
          for (const key of Object.keys(aggregatedAntiDetection)) {
            if (ad[key]?.active) aggregatedAntiDetection[key] = ad[key];
          }
          break;
        }
      }

      for (const slot of slots) {
        if (slot.status !== 'standby' && slot.fullUserId) {
          const job = automationQueue.running.get(slot.fullUserId);
          const worker = job?.worker;
          if (worker && typeof worker.getAntiDetectionStatus === 'function') {
            slot.antiDetection = worker.getAntiDetectionStatus();
          }
        }
      }

      res.json({ success: true, maxSlots, activeCount: runningEntries.length, queueCount: queueEntries.length, slots, waiting, antiDetection: aggregatedAntiDetection });
    } catch (error) {
      console.error('Worker slots error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
