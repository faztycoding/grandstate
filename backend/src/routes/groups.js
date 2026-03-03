import { Router } from 'express';

/**
 * Facebook Groups routes — fetch info & background update
 * - POST /groups/fetch-info
 * - POST /groups/update-all
 * - GET  /groups/update-all/status
 * - POST /groups/update-all/cancel
 */

// In-memory job store: userId → job state
const groupUpdateJobs = new Map();

// Shared scraping helpers
const NAME_BLACKLIST = [
  'การแจ้งเตือน', 'แชท', 'Chat', 'Notifications', 'Messenger',
  'Facebook', 'หน้าหลัก', 'Home', 'Watch', 'Marketplace',
  'สร้าง', 'Create', 'เมนู', 'Menu',
  'Groups', 'กลุ่ม', 'Group', 'กลุ่มของคุณ', 'Your groups',
  'เข้าร่วมกลุ่ม', 'Join group', 'ค้นพบ', 'Discover',
];

function isValidGroupName(name) {
  if (!name || name.length < 3) return false;
  return !NAME_BLACKLIST.some(b => name === b || name.startsWith(b + ' '));
}

export default function createGroupRoutes({ auth, sessionManager }) {
  const router = Router();

  // Fetch Facebook Group Info (name, member count)
  router.post('/groups/fetch-info', ...auth, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.includes('facebook.com/groups')) {
        return res.status(400).json({ success: false, error: 'Invalid Facebook group URL' });
      }

      // Initialize browser if needed
      if (!req.groupWorker.browser || !req.groupWorker.browser.isConnected()) {
        if (!sessionManager.canStartBrowser()) {
          return res.status(429).json({ success: false, error: 'Server busy — too many active browsers. Please try again later.' });
        }
        await req.groupWorker.initialize();
        sessionManager.registerBrowserStart();
      }

      const page = req.groupWorker.page;
      let aboutUrl = url.replace(/\/$/, '');
      if (!aboutUrl.includes('/about')) aboutUrl = aboutUrl + '/about';
      const groupSlug = url.match(/facebook\.com\/groups\/([^/?#]+)/)?.[1] || '';

      console.log('Fetching group info from:', aboutUrl);
      await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      let actualUrl = page.url();
      console.log(`🔍 [DEBUG] Landed on: ${actualUrl}`);
      console.log(`🔍 [DEBUG] Page title: ${await page.title()}`);

      const isOnLogin = () => {
        const u = page.url();
        return u.includes('/login') || u.includes('login.php');
      };

      // Login redirect strategies
      if (isOnLogin()) {
        console.log('🔄 [Strategy 1] Getting FB cookies first...');
        try {
          await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 2000));
          await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 3000));
          console.log(`🔍 [Strategy 1] Now on: ${page.url()}`);
        } catch (e) { console.log(`⚠️ [Strategy 1] Error: ${e.message}`); }
      }

      if (isOnLogin()) {
        console.log('🔄 [Strategy 2] Trying m.facebook.com...');
        try {
          const mobileUrl = `https://m.facebook.com/groups/${groupSlug}/about`;
          await page.goto(mobileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 3000));
          console.log(`🔍 [Strategy 2] Now on: ${page.url()}`);
        } catch (e) { console.log(`⚠️ [Strategy 2] Error: ${e.message}`); }
      }

      if (isOnLogin()) {
        console.log('🔄 [Strategy 3] Trying mbasic.facebook.com...');
        try {
          const mbasicUrl = `https://mbasic.facebook.com/groups/${groupSlug}?v=info`;
          await page.goto(mbasicUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 2000));
          console.log(`🔍 [Strategy 3] Now on: ${page.url()}`);
        } catch (e) { console.log(`⚠️ [Strategy 3] Error: ${e.message}`); }
      }

      actualUrl = page.url();
      console.log(`🔍 [FINAL] On page: ${actualUrl} | Title: ${await page.title()}`);
      await new Promise(r => setTimeout(r, 2000));

      // Close Facebook login popup overlay
      try {
        const closedPopup = await page.evaluate(() => {
          const closeBtn = document.querySelector('[aria-label="Close"][role="button"]');
          if (closeBtn) { closeBtn.click(); return 'aria-label'; }
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) {
            const btn = dialog.querySelector('[aria-label="Close"], [aria-label="ปิด"]');
            if (btn) { btn.click(); return 'dialog-close'; }
          }
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
      } catch (e) { /* silent */ }

      await new Promise(r => setTimeout(r, 500));

      // Scroll to trigger lazy-loaded activity section
      await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight * 0.5); });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => { window.scrollTo(0, 0); });
      await new Promise(r => setTimeout(r, 500));

      // Extract group name, member count, posts today/month, last activity
      const groupInfo = await page.evaluate(() => {
        let name = '';
        let memberCount = 0;

        const blacklist = [
          'การแจ้งเตือน', 'แชท', 'Chat', 'Notifications', 'Messenger',
          'Facebook', 'หน้าหลัก', 'Home', 'Watch', 'Marketplace',
          'สร้าง', 'Create', 'เมนู', 'Menu',
          'Groups', 'กลุ่ม', 'Group', 'กลุ่มของคุณ', 'Your groups',
          'เข้าร่วมกลุ่ม', 'Join group', 'ค้นพบ', 'Discover',
        ];
        const isBlacklisted = (text) => blacklist.some(b => text === b || text.startsWith(b + ' '));

        // ======= FIND GROUP NAME =======
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
          const ogText = ogTitle.getAttribute('content')?.trim() || '';
          if (ogText && ogText.length > 2 && !isBlacklisted(ogText)) name = ogText;
        }
        if (!name) {
          const title = document.title || '';
          if (title.includes('|')) { const c = title.split('|')[0].trim(); if (c && c.length > 2 && !isBlacklisted(c)) name = c; }
          else if (title.includes('-')) { const c = title.split('-')[0].trim(); if (c && c.length > 2 && !isBlacklisted(c)) name = c; }
        }
        if (!name) {
          const h1Elements = document.querySelectorAll('h1');
          for (const h1 of h1Elements) {
            const span = h1.querySelector('span');
            const text = span ? (span.textContent?.trim() || '') : (h1.textContent?.trim() || '');
            if (text && text.length > 2 && !isBlacklisted(text)) { name = text; break; }
          }
        }
        if (!name) {
          const groupLinks = document.querySelectorAll('a[href*="/groups/"]');
          for (const link of groupLinks) {
            const ariaLabel = link.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.length > 5 && !isBlacklisted(ariaLabel)) { name = ariaLabel; break; }
          }
        }

        // ======= FIND MEMBER COUNT =======
        const bodyText = document.body.innerText;
        let match;
        const thaiUnits = { 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };

        match = bodyText.match(/สมาชิก\s*([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)/);
        if (match) memberCount = Math.round(parseFloat(match[1].replace(',', '.')) * (thaiUnits[match[2]] || 1));
        if (!memberCount) { match = bodyText.match(/([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)\s*(?:คน\s*)?สมาชิก/); if (match) memberCount = Math.round(parseFloat(match[1].replace(',', '.')) * (thaiUnits[match[2]] || 1)); }
        if (!memberCount) { match = bodyText.match(/สมาชิก\s*([\d,]+)\s*คน/); if (match) memberCount = parseInt(match[1].replace(/,/g, '')); }
        if (!memberCount) { match = bodyText.match(/สมาชิก\s*([\d,]+)/); if (match && parseInt(match[1].replace(/,/g, '')) > 0) memberCount = parseInt(match[1].replace(/,/g, '')); }
        if (!memberCount) { match = bodyText.match(/([\d,]+)\s*สมาชิก/); if (match && parseInt(match[1].replace(/,/g, '')) > 0) memberCount = parseInt(match[1].replace(/,/g, '')); }
        if (!memberCount) { match = bodyText.match(/([\d.]+)\s*[Kk]\s*members/i); if (match) memberCount = Math.round(parseFloat(match[1]) * 1000); }
        if (!memberCount) { match = bodyText.match(/([\d.]+)\s*[Mm]\s*members/i); if (match) memberCount = Math.round(parseFloat(match[1]) * 1000000); }
        if (!memberCount) { match = bodyText.match(/([\d,]+)\s*members/i); if (match && parseInt(match[1].replace(/,/g, '')) > 0) memberCount = parseInt(match[1].replace(/,/g, '')); }
        if (!memberCount) { match = bodyText.match(/([\d,]+)\s*total\s*members/i); if (match) memberCount = parseInt(match[1].replace(/,/g, '')); }
        if (!memberCount) { match = bodyText.match(/([\d.]+)\s*[Kk]\s*(?:คน\s*)?สมาชิก/); if (match) memberCount = Math.round(parseFloat(match[1]) * 1000); }
        if (!memberCount) { match = bodyText.match(/([\d.]+)\s*[Mm]\s*(?:คน\s*)?สมาชิก/); if (match) memberCount = Math.round(parseFloat(match[1]) * 1000000); }

        // ======= FIND LAST ACTIVITY =======
        let lastActivity = undefined;
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
          if (m) { const num = parseInt(m[1]); const unit = activityUnits[m[2]] || m[2]; lastActivity = `${num} ${unit} ago`; break; }
        }
        if (!lastActivity) {
          if (/อัปเดต.*วันนี้|Updated.*today/i.test(bodyText)) lastActivity = 'today';
          else if (/อัปเดต.*เมื่อวาน|Updated.*yesterday/i.test(bodyText)) lastActivity = 'yesterday';
        }

        // ======= FIND POSTS TODAY & LAST MONTH =======
        let postsToday;
        let postsLastMonth;

        const parseCompactMetric = (rawValue) => {
          if (!rawValue) return undefined;
          const compact = String(rawValue).replace(/\u00A0/g, ' ').trim().replace(/\s+/g, '');
          const matched = compact.match(/^([\d.,]+)([KkMm]|พัน|หมื่น|แสน|ล้าน)?$/);
          if (!matched) return undefined;
          const numberPart = matched[1];
          const suffix = matched[2] || '';
          let normalized = numberPart;
          if (numberPart.includes('.') && numberPart.includes(',')) normalized = numberPart.replace(/,/g, '');
          else if (!numberPart.includes('.') && /,\d{1,2}$/.test(numberPart)) normalized = numberPart.replace(',', '.');
          else normalized = numberPart.replace(/,/g, '');
          const base = parseFloat(normalized);
          if (!Number.isFinite(base)) return undefined;
          const normalizedSuffix = suffix === 'K' ? 'k' : (suffix === 'M' ? 'm' : suffix);
          const multipliers = { k: 1000, m: 1000000, 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };
          return Math.round(base * (multipliers[normalizedSuffix] || 1));
        };

        const countToken = '([\\d.,]+\\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)';
        const todayPatterns = [
          new RegExp(`${countToken}\\s*โพสต์ใหม่ในวันนี้`, 'i'), new RegExp(`${countToken}\\s*โพสต์ใหม่วันนี้`, 'i'),
          new RegExp(`${countToken}\\s*โพสต์\\s*วันนี้`, 'i'), new RegExp(`${countToken}\\s*new\\s*posts?\\s*today`, 'i'),
          new RegExp(`โพสต์ใหม่ในวันนี้\\s*[:\\-]?\\s*${countToken}`, 'i'), new RegExp(`new\\s*posts?\\s*today\\s*[:\\-]?\\s*${countToken}`, 'i'),
          new RegExp(`${countToken}\\s*[\\-–]\\s*โพสต์(?:ใหม่)?(?:ใน)?วันนี้`, 'i'), new RegExp(`${countToken}\\s*[\\-–]\\s*new\\s*posts?\\s*today`, 'i'),
          new RegExp(`วันนี้.*?(\\d[\\d.,]*)\\s*โพสต์`, 'i'), new RegExp(`โพสต์(?:ใหม่)?\\s*(?:ใน)?วันนี้\\s*${countToken}`, 'i'),
          new RegExp(`today\\s*[:\\-]?\\s*${countToken}\\s*posts?`, 'i'),
        ];
        const monthPatterns = [
          new RegExp(`${countToken}\\s*โพสต์ในเดือนที่ผ่านมา`, 'i'), new RegExp(`${countToken}\\s*โพสต์เมื่อเดือนที่แล้ว`, 'i'),
          new RegExp(`${countToken}\\s*โพสต์ต่อเดือน`, 'i'), new RegExp(`${countToken}\\s*โพสต์\\s*\\/\\s*เดือน`, 'i'),
          new RegExp(`${countToken}\\s*โพสต์ในช่วง\\s*30\\s*วันที่ผ่านมา`, 'i'), new RegExp(`${countToken}\\s*posts?\\s*in\\s*the\\s*last\\s*month`, 'i'),
          new RegExp(`${countToken}\\s*posts?\\s*last\\s*month`, 'i'), new RegExp(`${countToken}\\s*posts?\\s*\\/\\s*month`, 'i'),
          new RegExp(`${countToken}\\s*posts?\\s*in\\s*the\\s*last\\s*30\\s*days`, 'i'),
          new RegExp(`โพสต์ในเดือนที่ผ่านมา\\s*[:\\-]?\\s*${countToken}`, 'i'), new RegExp(`posts?\\s*in\\s*the\\s*last\\s*month\\s*[:\\-]?\\s*${countToken}`, 'i'),
          new RegExp(`${countToken}\\s*[\\-–]\\s*โพสต์\\s*\\/\\s*เดือน`, 'i'), new RegExp(`${countToken}\\s*[\\-–]\\s*โพสต์ต่อเดือน`, 'i'),
          new RegExp(`${countToken}\\s*[\\-–]\\s*posts?\\s*\\/\\s*month`, 'i'),
          new RegExp(`เดือน(?:ที่ผ่านมา|ที่แล้ว).*?(\\d[\\d.,]*)\\s*โพสต์`, 'i'),
          new RegExp(`โพสต์\\s*(?:\\/|ต่อ)\\s*เดือน\\s*${countToken}`, 'i'),
          new RegExp(`last\\s*month\\s*[:\\-]?\\s*${countToken}\\s*posts?`, 'i'),
          new RegExp(`${countToken}\\s*in\\s*the\\s*last\\s*month`, 'i'),
          new RegExp(`${countToken}\\s*in\\s*the\\s*last\\s*30\\s*days`, 'i'),
        ];

        const extractMetricFromText = (text, patterns) => {
          for (const pattern of patterns) {
            const matched = text.match(pattern);
            if (matched && matched[1]) { const parsed = parseCompactMetric(matched[1]); if (typeof parsed === 'number') return parsed; }
          }
          return undefined;
        };

        const allSpans = document.querySelectorAll('span');
        const debugTexts = [];

        allSpans.forEach(span => {
          const text = span.textContent?.trim() || '';
          if (text.length > 0 && text.length < 200 && (
            (text.match(/\d/) && (text.includes('โพสต์') || text.includes('post') || text.includes('เดือน') || text.includes('month') || text.includes('วันนี้') || text.includes('today'))) ||
            text.includes('กิจกรรม') || text.includes('activity')
          )) { debugTexts.push(text.substring(0, 120)); }

          if (postsToday === undefined) { const value = extractMetricFromText(text, todayPatterns); if (value !== undefined) postsToday = value; }
          if (postsLastMonth === undefined) { const value = extractMetricFromText(text, monthPatterns); if (value !== undefined) postsLastMonth = value; }
        });

        // Fallback A: Adjacent-element extraction
        if (postsToday === undefined || postsLastMonth === undefined) {
          const todayLabels = ['โพสต์ใหม่ในวันนี้', 'โพสต์ใหม่วันนี้', 'โพสต์วันนี้', 'new posts today', 'new post today'];
          const monthLabels = ['โพสต์ในเดือนที่ผ่านมา', 'โพสต์เมื่อเดือนที่แล้ว', 'โพสต์ต่อเดือน', 'โพสต์/เดือน', 'โพสต์ในช่วง 30 วันที่ผ่านมา', 'posts in the last month', 'posts last month', 'posts/month'];

          allSpans.forEach(span => {
            const text = (span.textContent?.trim() || '').toLowerCase();
            const matchLabel = (labels) => labels.some(l => text === l.toLowerCase() || text.includes(l.toLowerCase()));
            const findPrev = (el) => {
              let prev = el.previousElementSibling;
              if (!prev && el.parentElement) prev = el.parentElement.previousElementSibling;
              if (!prev && el.parentElement?.parentElement) {
                const parent = el.parentElement.parentElement;
                const children = Array.from(parent.children);
                const idx = children.indexOf(el.parentElement);
                if (idx > 0) prev = children[idx - 1];
              }
              return prev;
            };

            if (matchLabel(todayLabels) && postsToday === undefined) {
              const prev = findPrev(span);
              if (prev) { const val = parseCompactMetric(prev.textContent?.trim() || ''); if (typeof val === 'number') { postsToday = val; debugTexts.push(`[ADJ-TODAY] "${prev.textContent?.trim()}" + "${text}"`); } }
            }
            if (matchLabel(monthLabels) && postsLastMonth === undefined) {
              const prev = findPrev(span);
              if (prev) { const val = parseCompactMetric(prev.textContent?.trim() || ''); if (typeof val === 'number') { postsLastMonth = val; debugTexts.push(`[ADJ-MONTH] "${prev.textContent?.trim()}" + "${text}"`); } }
            }
          });
        }

        // Fallback B: Search in bodyText
        if (postsToday === undefined || postsLastMonth === undefined) {
          const postsBodyText = document.body.innerText;
          if (postsToday === undefined) postsToday = extractMetricFromText(postsBodyText, todayPatterns);
          if (postsLastMonth === undefined) postsLastMonth = extractMetricFromText(postsBodyText, monthPatterns);
          const totalMemberMatch = postsBodyText.match(/สมาชิกทั้งหมด\s*([\d,]+)\s*ราย/);
          if (totalMemberMatch) memberCount = parseInt(totalMemberMatch[1].replace(/,/g, ''));
        }

        // Fallback C: Line-based extraction
        if (postsToday === undefined || postsLastMonth === undefined) {
          const lines = document.body.innerText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
          for (let li = 0; li < lines.length - 1; li++) {
            const numLine = lines[li];
            const labelLine = lines[li + 1].toLowerCase();
            if (postsToday === undefined && (labelLine.includes('โพสต์ใหม่') && labelLine.includes('วันนี้') || labelLine.includes('new post') && labelLine.includes('today'))) {
              const val = parseCompactMetric(numLine); if (typeof val === 'number') { postsToday = val; debugTexts.push(`[LINE-TODAY] "${numLine}" / "${lines[li + 1]}"`); }
            }
            if (postsLastMonth === undefined && (labelLine.includes('โพสต์') && (labelLine.includes('เดือน') || labelLine.includes('30 วัน')) || labelLine.includes('post') && (labelLine.includes('month') || labelLine.includes('30 day')))) {
              const val = parseCompactMetric(numLine); if (typeof val === 'number') { postsLastMonth = val; debugTexts.push(`[LINE-MONTH] "${numLine}" / "${lines[li + 1]}"`); }
            }
          }
        }

        if (name) name = name.replace(/^\(\d+\)\s*/, '').trim();
        return { name, memberCount, postsToday, postsLastMonth, lastActivity, debugTexts };
      });

      if (groupInfo.debugTexts && groupInfo.debugTexts.length > 0) {
        console.log(`🔍 Debug: Found ${groupInfo.debugTexts.length} span texts with numbers + 'post/โพสต์':`);
        console.log(groupInfo.debugTexts.slice(0, 10));
      }
      console.log(`📊 Scraped: ${groupInfo.name?.substring(0, 40)} | Members: ${groupInfo.memberCount} | Today: ${groupInfo.postsToday} | Month: ${groupInfo.postsLastMonth} | Activity: ${groupInfo.lastActivity || '-'}`);

      res.json({
        success: true,
        groupInfo: {
          name: groupInfo.name || '', memberCount: groupInfo.memberCount || 0,
          postsToday: typeof groupInfo.postsToday === 'number' ? groupInfo.postsToday : undefined,
          postsLastMonth: typeof groupInfo.postsLastMonth === 'number' ? groupInfo.postsLastMonth : undefined,
          lastActivity: groupInfo.lastActivity || null, url: url, lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Fetch group info error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Start background update of all active groups
  router.post('/groups/update-all', ...auth, async (req, res) => {
    try {
      const { groups } = req.body;
      if (!groups || !Array.isArray(groups) || groups.length === 0) {
        return res.status(400).json({ success: false, error: 'groups array is required' });
      }

      const existing = groupUpdateJobs.get(req.userId);
      if (existing && existing.status === 'running') {
        return res.json({ success: true, message: 'already_running', jobId: existing.jobId, current: existing.current, total: existing.total });
      }

      const jobId = `gu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const job = { jobId, userId: req.userId, status: 'running', total: groups.length, current: 0, success: 0, failed: 0, currentGroupName: '', startedAt: Date.now(), finishedAt: null, error: null };
      groupUpdateJobs.set(req.userId, job);
      res.json({ success: true, jobId, total: groups.length, message: 'started' });

      // Background processing
      const supaUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      const groupWorker = req.groupWorker;

      (async () => {
        try {
          if (!groupWorker.browser || !groupWorker.browser.isConnected()) {
            if (!sessionManager.canStartBrowser()) { job.status = 'error'; job.error = 'Server busy — too many active browsers'; job.finishedAt = Date.now(); return; }
            await groupWorker.initialize(); sessionManager.registerBrowserStart();
          }

          for (let i = 0; i < groups.length; i++) {
            if (job.status === 'cancelled') { console.log(`🛑 [BG-Update] Cancelled by user at ${i}/${groups.length}`); break; }
            const group = groups[i];
            job.current = i + 1;
            job.currentGroupName = group.name || `Group ${i + 1}`;

            try {
              const page = groupWorker.page;
              let aboutUrl = group.url.replace(/\/$/, '');
              if (!aboutUrl.includes('/about')) aboutUrl += '/about';
              const groupSlug = group.url.match(/facebook\.com\/groups\/([^/?#]+)/)?.[1] || '';

              await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }));

              const isOnLogin = () => { const u = page.url(); return u.includes('/login') || u.includes('login.php'); };

              if (isOnLogin()) { try { await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 15000 }); await new Promise(r => setTimeout(r, 2000)); await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }); await new Promise(r => setTimeout(r, 3000)); } catch (e) { /* silent */ } }
              if (isOnLogin()) { try { await page.goto(`https://m.facebook.com/groups/${groupSlug}/about`, { waitUntil: 'domcontentloaded', timeout: 20000 }); await new Promise(r => setTimeout(r, 3000)); } catch (e) { /* silent */ } }
              if (isOnLogin()) { try { await page.goto(`https://mbasic.facebook.com/groups/${groupSlug}?v=info`, { waitUntil: 'domcontentloaded', timeout: 20000 }); await new Promise(r => setTimeout(r, 2000)); } catch (e) { /* silent */ } }

              await new Promise(r => setTimeout(r, 2000));
              try { await page.evaluate(() => { const c = document.querySelector('[aria-label="Close"][role="button"]') || document.querySelector('[aria-label="ปิด"][role="button"]'); if (c) c.click(); }); await new Promise(r => setTimeout(r, 1000)); } catch (e) { /* silent */ }

              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5)); await new Promise(r => setTimeout(r, 2000));
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await new Promise(r => setTimeout(r, 2000));
              await page.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 500));

              // Simplified scraping for background update
              const info = await page.evaluate(() => {
                let name = '';
                let memberCount = 0;

                // Strategy 1: og:title meta tag
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle) name = ogTitle.getAttribute('content')?.trim() || '';

                // Strategy 2: document.title
                if (!name) { const title = document.title || ''; if (title.includes('|')) name = title.split('|')[0].trim(); else if (title.includes('-')) name = title.split('-')[0].trim(); }

                // Strategy 3: h1 heading (Facebook SPA renders group name in h1)
                if (!name) {
                  const h1s = document.querySelectorAll('h1');
                  for (const h1 of h1s) {
                    const t = h1.textContent?.trim() || '';
                    if (t.length >= 3 && t.length < 200 && !t.includes('Facebook') && !t.includes('เข้าสู่ระบบ') && !t.includes('Log')) {
                      name = t; break;
                    }
                  }
                }

                // Strategy 4: aria-label on main heading link
                if (!name) {
                  const headingLinks = document.querySelectorAll('a[role="link"] h2, h2 a[role="link"], [role="main"] h2');
                  for (const el of headingLinks) {
                    const t = (el.textContent || el.closest('a')?.textContent || '').trim();
                    if (t.length >= 3 && t.length < 200) { name = t; break; }
                  }
                }

                // Strategy 5: Structured data / JSON-LD
                if (!name) {
                  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                  for (const s of scripts) {
                    try { const d = JSON.parse(s.textContent); if (d.name) { name = d.name; break; } } catch {}
                  }
                }

                // Strategy 6: First large visible heading in main content
                if (!name) {
                  const mainEl = document.querySelector('[role="main"]');
                  if (mainEl) {
                    const headings = mainEl.querySelectorAll('h1, h2, span[dir="auto"]');
                    for (const h of headings) {
                      const t = h.textContent?.trim() || '';
                      const rect = h.getBoundingClientRect();
                      if (t.length >= 3 && t.length < 200 && rect.width > 100 && rect.height > 15 &&
                          !t.includes('สมาชิก') && !t.includes('member') && !t.includes('โพสต์') && !t.includes('post')) {
                        name = t; break;
                      }
                    }
                  }
                }

                if (name) name = name.replace(/^\(\d+\)\s*/, '').trim();

                const bodyText = document.body.innerText;
                const thaiUnits = { 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };
                const memberPatterns = [
                  [/สมาชิก\s*([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)/, true], [/([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)\s*(?:คน\s*)?สมาชิก/, true],
                  [/สมาชิก\s*([\d,]+)\s*คน/, false], [/สมาชิก\s*([\d,]+)/, false], [/([\d,]+)\s*สมาชิก/, false],
                  [/([\d.]+)\s*[Kk]\s*members/i, 'K'], [/([\d.]+)\s*[Mm]\s*members/i, 'M'], [/([\d,]+)\s*members/i, false],
                ];
                for (const [pat, unit] of memberPatterns) {
                  const m = bodyText.match(pat);
                  if (m && !memberCount) {
                    if (unit === true) memberCount = Math.round(parseFloat(m[1].replace(',', '.')) * (thaiUnits[m[2]] || 1));
                    else if (unit === 'K') memberCount = Math.round(parseFloat(m[1]) * 1000);
                    else if (unit === 'M') memberCount = Math.round(parseFloat(m[1]) * 1000000);
                    else memberCount = parseInt(m[1].replace(/,/g, ''));
                  }
                }

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
                const spans = document.querySelectorAll('span');
                const todayLabels = ['โพสต์ใหม่ในวันนี้', 'โพสต์ใหม่วันนี้', 'โพสต์วันนี้', 'new posts today', 'new post today'];
                const monthLabels = ['โพสต์ในเดือนที่ผ่านมา', 'โพสต์เมื่อเดือนที่แล้ว', 'โพสต์ต่อเดือน', 'โพสต์/เดือน', 'posts in the last month', 'posts last month', 'in the last month'];
                spans.forEach(span => {
                  const t = (span.textContent?.trim() || '').toLowerCase();
                  const findPrev = (el) => { let p = el.previousElementSibling; if (!p && el.parentElement) p = el.parentElement.previousElementSibling; return p ? (p.textContent?.trim() || '') : ''; };
                  if (postsToday === undefined && todayLabels.some(l => t.includes(l.toLowerCase()))) { const v = parseCompact(findPrev(span)); if (v !== undefined) postsToday = v; }
                  if (postsLastMonth === undefined && monthLabels.some(l => t.includes(l.toLowerCase()))) { const v = parseCompact(findPrev(span)); if (v !== undefined) postsLastMonth = v; }
                });
                if (postsToday === undefined) { const m = bodyText.match(/([\d.,]+\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)\s*โพสต์(?:ใหม่)?(?:ใน)?วันนี้/); if (m) postsToday = parseCompact(m[1]); }
                if (postsLastMonth === undefined) { const m = bodyText.match(/([\d.,]+\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)\s*(?:โพสต์)?(?:ใน)?เดือนที่ผ่านมา/); if (m) postsLastMonth = parseCompact(m[1]); }
                if (postsLastMonth === undefined) { const m = bodyText.match(/([\d.,]+\s*(?:[KkMm])?)\s*in the last month/i); if (m) postsLastMonth = parseCompact(m[1]); }
                return { name, memberCount, postsToday, postsLastMonth };
              });

              console.log(`📊 [BG-Update ${i + 1}/${groups.length}] ${info.name?.substring(0, 30)} | Members: ${info.memberCount} | Today: ${info.postsToday} | Month: ${info.postsLastMonth}`);

              const scrapedName = info.name || '';
              const newName = isValidGroupName(scrapedName) ? scrapedName : group.name;
              const updates = { name: newName || group.name, member_count: info.memberCount || group.memberCount || 0, last_updated: new Date().toISOString() };
              if (typeof info.postsToday === 'number') updates.posts_today = info.postsToday;
              if (typeof info.postsLastMonth === 'number') updates.posts_last_month = info.postsLastMonth;

              const patchRes = await fetch(`${supaUrl}/rest/v1/facebook_groups?id=eq.${group.id}&user_id=eq.${req.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Prefer': 'return=minimal' },
                body: JSON.stringify(updates),
              });
              if (!patchRes.ok) { console.warn(`⚠️ [BG-Update] Supabase PATCH failed for group ${group.id}: ${patchRes.status}`); job.failed++; }
              else { job.success++; }
            } catch (err) { console.warn(`⚠️ [BG-Update] Error on group ${group.name}: ${err.message}`); job.failed++; }

            if (i < groups.length - 1) await new Promise(r => setTimeout(r, 2000));
          }

          job.status = 'done'; job.finishedAt = Date.now();
          console.log(`✅ [BG-Update] Completed for user ${req.userId.slice(0, 8)}: ${job.success} success, ${job.failed} failed`);
          setTimeout(() => { const current = groupUpdateJobs.get(req.userId); if (current && current.jobId === jobId) groupUpdateJobs.delete(req.userId); }, 10 * 60 * 1000);
        } catch (err) { job.status = 'error'; job.error = err.message; job.finishedAt = Date.now(); console.error(`❌ [BG-Update] Fatal error: ${err.message}`); }
      })();
    } catch (error) {
      console.error('Update-all start error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Poll background group update status
  router.get('/groups/update-all/status', ...auth, (req, res) => {
    const job = groupUpdateJobs.get(req.userId);
    if (!job) return res.json({ success: true, status: 'idle', message: 'No active update job' });
    res.json({
      success: true, jobId: job.jobId, status: job.status, total: job.total, current: job.current,
      successCount: job.success, failedCount: job.failed, currentGroupName: job.currentGroupName,
      startedAt: job.startedAt, finishedAt: job.finishedAt, error: job.error,
    });
  });

  // Cancel background group update
  router.post('/groups/update-all/cancel', ...auth, (req, res) => {
    const job = groupUpdateJobs.get(req.userId);
    if (!job || job.status !== 'running') return res.json({ success: true, message: 'No running job to cancel' });
    job.status = 'cancelled'; job.finishedAt = Date.now();
    res.json({ success: true, message: 'Job cancelled' });
  });

  return router;
}
