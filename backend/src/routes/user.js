import { Router } from 'express';

/**
 * User & Session routes
 * - POST /session/presence
 * - GET  /session/active-users
 * - GET  /user/profile
 * - GET  /user/real-stats
 * - GET  /notifications/poll
 * - DELETE /support-tickets/:id
 */
export default function createUserRoutes({ auth, sessionManager, ADMIN_EMAILS, generateDisplayId }) {
  const router = Router();

  // Presence heartbeat (auth required)
  router.post('/session/presence', ...auth, (req, res) => {
    try {
      const isOnline = req.body?.online !== false;
      if (isOnline) {
        sessionManager.touchPresence(req.userId, req.userEmail, req.userMeta);
      } else {
        sessionManager.markOffline(req.userId);
      }
      res.json({ success: true, online: isOnline, ...sessionManager.getPresenceStats(ADMIN_EMAILS) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Active users count for sidebar display
  router.get('/session/active-users', ...auth, (req, res) => {
    try {
      sessionManager.touchPresence(req.userId, req.userEmail, req.userMeta);
      res.json({ success: true, ...sessionManager.getPresenceStats(ADMIN_EMAILS) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // User profile — returns display_id (auto-generates if missing)
  router.get('/user/profile', ...auth, async (req, res) => {
    try {
      const supaUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

      const resp = await fetch(`${supaUrl}/rest/v1/users?id=eq.${req.userId}&select=id,email,full_name,display_id`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
      });

      let profile = null;
      if (resp.ok) {
        const rows = await resp.json();
        profile = rows[0] || null;
      }

      if (profile && !profile.display_id) {
        const newId = generateDisplayId();
        await fetch(`${supaUrl}/rest/v1/users?id=eq.${req.userId}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ display_id: newId }),
        });
        profile.display_id = newId;
        console.log(`🆔 Generated display_id ${newId} for user ${req.userId.substring(0, 8)}`);
      }

      if (!profile) {
        const newId = generateDisplayId();
        await fetch(`${supaUrl}/rest/v1/users`, {
          method: 'POST',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
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

  // User real stats
  router.get('/user/real-stats', ...auth, async (req, res) => {
    try {
      const userId = req.userId;
      const supaUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      const headers = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

      let postsToday = 0;
      let automationRuns = 0;
      try {
        const session = sessionManager.sessions.get(userId);
        if (session?.postingTracker) {
          const todayStats = session.postingTracker.getTodayStats('elite');
          postsToday = todayStats.postsCount || 0;
          automationRuns = todayStats.automationRuns || 0;
        } else {
          const { PostingTracker } = await import('../services/postingTracker.js');
          const pt = new PostingTracker(userId);
          const ts = pt.getTodayStats('elite');
          postsToday = ts.postsCount || 0;
          automationRuns = ts.automationRuns || 0;
        }
      } catch (e) { /* non-critical */ }

      let groupsCount = 0;
      try {
        const r = await fetch(`${supaUrl}/rest/v1/facebook_groups?user_id=eq.${userId}&select=id`, {
          headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' },
        });
        const ct = r.headers.get('content-range');
        if (ct) groupsCount = parseInt(ct.split('/')[1] || '0', 10) || 0;
        else { const d = await r.json(); groupsCount = Array.isArray(d) ? d.length : 0; }
      } catch (e) { /* non-critical */ }

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

  // Notifications — Poll for admin replies
  router.get('/notifications/poll', ...auth, async (req, res) => {
    try {
      const supaUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!supaUrl || !serviceKey) return res.json({ success: true, notifications: [] });

      const resp = await fetch(
        `${supaUrl}/rest/v1/support_tickets?user_id=eq.${req.userId}&admin_reply=not.is.null&select=id,subject,category,admin_reply,admin_replied_at,status&order=admin_replied_at.desc&limit=10`,
        { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
      );
      if (!resp.ok) return res.json({ success: true, notifications: [] });
      const tickets = await resp.json();

      const session = sessionManager.getSession(req.userId);
      const seenReplies = session?._seenTicketReplies || new Set();

      const newNotifications = [];
      for (const t of tickets) {
        const replyKey = `${t.id}_${t.admin_replied_at}`;
        if (!seenReplies.has(replyKey)) {
          seenReplies.add(replyKey);
          newNotifications.push({
            id: replyKey, type: 'admin_reply', category: 'admin',
            title: `ผู้ดูแลตอบกลับ: ${t.subject}`, message: t.admin_reply.substring(0, 200),
            ticketId: t.id, timestamp: new Date(t.admin_replied_at).getTime(),
          });
        }
      }
      if (session) session._seenTicketReplies = seenReplies;
      res.json({ success: true, notifications: newNotifications });
    } catch (error) {
      console.error('Notification poll error:', error);
      res.json({ success: true, notifications: [] });
    }
  });

  // Support Tickets — Delete (owner only)
  router.delete('/support-tickets/:id', ...auth, async (req, res) => {
    try {
      const ticketId = req.params.id;
      const supaUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!supaUrl || !serviceKey) return res.status(500).json({ success: false, error: 'Supabase not configured' });

      const checkResp = await fetch(
        `${supaUrl}/rest/v1/support_tickets?id=eq.${ticketId}&user_id=eq.${req.userId}&select=id`,
        { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
      );
      if (!checkResp.ok) return res.status(500).json({ success: false, error: 'DB error' });
      const found = await checkResp.json();
      if (!found || found.length === 0) return res.status(403).json({ success: false, error: 'Not your ticket' });

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

  return router;
}
