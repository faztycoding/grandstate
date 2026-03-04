import { Router } from 'express';
import path from 'path';

/**
 * Facebook Connection routes (Multi-Session)
 * - POST /facebook/connect
 * - POST /facebook/auto-login
 * - POST /facebook/re-login
 * - GET  /facebook/session-health
 * - GET  /facebook/status
 * - POST /facebook/disconnect
 * - POST /facebook/confirm-login
 */

// Helper: scrape FB user info from current page
const FB_NAME_BLACKLIST = [
  'facebook', 'log in', 'log into', 'sign up', 'เข้าสู่ระบบ', 'สมัครสมาชิก',
  'messenger', 'watch', 'marketplace', 'notifications', 'การแจ้งเตือน',
  'หน้าหลัก', 'home', 'แชท', 'chat', 'สร้าง', 'create', 'เมนู', 'menu',
  'groups', 'กลุ่ม', 'reels', 'stories', 'gaming', 'video',
];
function isValidFbName(n) {
  if (!n || n.length < 2 || n.length > 60) return false;
  const lower = n.toLowerCase().trim();
  return !FB_NAME_BLACKLIST.some(b => lower === b);
}

async function scrapeFbUserInfo(page) {
  let name = '';
  let profilePic = '';

  try {
    const pageUrl = page.url();
    const pageTitle = await page.title().catch(() => '');
    console.log(`🔍 [scrapeFbUserInfo] URL: ${pageUrl} | Title: "${pageTitle}"`);

    const isLoginPage = await page.evaluate(() => {
      return !!(document.querySelector('input[name="email"]') || document.querySelector('input[name="pass"]') || document.querySelector('#email') || document.querySelector('#pass'));
    }).catch(() => false);

    if (isLoginPage) {
      console.log('⚠️ scrapeFbUserInfo: Login page detected — returning empty');
      return { name: '', profilePic: '' };
    }

    // ── ALWAYS navigate to /me/ profile page first (most reliable) ──
    console.log('🔍 [scrapeFbUserInfo] Navigating to /me/ for accurate profile scrape...');
    try {
      await page.goto('https://www.facebook.com/me/', { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 4000));

      const meIsLogin = await page.evaluate(() => {
        return !!(document.querySelector('input[name="email"]') || document.querySelector('input[name="pass"]'));
      }).catch(() => false);

      if (meIsLogin) {
        console.log('⚠️ [/me/] Login page — not logged in');
        return { name: '', profilePic: '' };
      }

      const meUrl = page.url();
      const meTitle = await page.title().catch(() => '');
      console.log(`🔍 [/me/] URL: ${meUrl} | Title: "${meTitle}"`);

      // Strategy 1: Facebook's profile name span (class-based selector)
      if (!name) {
        const spanName = await page.evaluate(() => {
          // Facebook uses these specific class combinations for the profile display name
          const selectors = [
            'h1 span',                                   // Profile page h1
            'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6', // FB's profile name span class
            '[data-pagelet="ProfileActions"] h1',         // Profile actions header
          ];
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              const text = el.textContent?.trim() || '';
              if (text.length >= 2 && text.length < 60) return text;
            }
          }
          return '';
        }).catch(() => '');
        if (isValidFbName(spanName)) { name = spanName; console.log(`✅ [/me/] Got name from span/h1: "${name}"`); }
      }

      // Strategy 2: Page title
      if (!name && meTitle) {
        const cleaned = meTitle.replace(/^\(\d+\)\s*/, '');
        let candidate = '';
        if (cleaned.includes(' | ')) candidate = cleaned.split(' | ')[0].trim();
        else if (cleaned.includes(' - ')) candidate = cleaned.split(' - ')[0].trim();
        if (isValidFbName(candidate)) { name = candidate; console.log(`✅ [/me/] Got name from title: "${name}"`); }
      }

      // Strategy 3: og:title meta tag
      if (!name) {
        const ogName = await page.evaluate(() => { const og = document.querySelector('meta[property="og:title"]'); return og?.getAttribute('content')?.trim() || ''; }).catch(() => '');
        if (isValidFbName(ogName)) { name = ogName; console.log(`✅ [/me/] Got name from og:title: "${name}"`); }
      }

      // Strategy 4: URL-based name (facebook.com/username → decode)
      if (!name && meUrl.includes('facebook.com/') && !meUrl.includes('/me/') && !meUrl.includes('/login')) {
        const urlPath = new URL(meUrl).pathname.replace(/^\//, '').replace(/\/$/, '');
        if (urlPath && urlPath.length >= 2 && !urlPath.includes('/') && !urlPath.startsWith('profile.php')) {
          const decoded = decodeURIComponent(urlPath).replace(/\./g, ' ');
          if (isValidFbName(decoded)) { name = decoded; console.log(`✅ [/me/] Got name from URL path: "${name}"`); }
        }
      }
    } catch (navErr) {
      console.log(`⚠️ [/me/] Navigation failed: ${navErr.message}`);
    }

    // Fallback: try current page title if /me/ failed
    if (!name && pageTitle) {
      const cleaned = pageTitle.replace(/^\(\d+\)\s*/, '');
      let candidate = '';
      if (cleaned.includes(' | ')) candidate = cleaned.split(' | ')[0].trim();
      else if (cleaned.includes(' - ')) candidate = cleaned.split(' - ')[0].trim();
      if (isValidFbName(candidate)) {
        name = candidate;
        console.log(`✅ [scrapeFbUserInfo] Got name from original page title: "${name}"`);
      }
    }

    // Extract profile pic — prioritize actual profile photo over cover/other images
    profilePic = await page.evaluate(() => {
      // Strategy 1: og:image meta tag (Facebook sets this to the profile pic on /me/)
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) {
        const url = ogImg.getAttribute('content') || '';
        if (url.includes('scontent') || url.includes('fbcdn')) return url;
      }
      // Strategy 2: Profile photo link's SVG image (usually inside a[aria-label] with profile pic)
      const profileLinks = document.querySelectorAll('a[aria-label*="profile"], a[aria-label*="โปรไฟล์"], [data-pagelet="ProfileActions"] image, svg image');
      for (const el of profileLinks) {
        const img = el.tagName === 'image' ? el : el.querySelector('image');
        if (img) {
          const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
          if (href.includes('scontent') || href.includes('fbcdn')) return href;
        }
      }
      // Strategy 3: First SVG image with scontent (common FB profile pic render)
      const svgImgs = document.querySelectorAll('image');
      for (const img of svgImgs) { const href = img.getAttribute('xlink:href') || img.getAttribute('href') || ''; if (href.includes('scontent')) return href; }
      // Strategy 4: img tags with scontent
      const imgs = document.querySelectorAll('img[src*="scontent"]');
      for (const img of imgs) { const src = img.getAttribute('src') || ''; if (src.includes('scontent')) return src; }
      return '';
    }).catch(() => '');

  } catch (e) { console.log('⚠️ scrapeFbUserInfo error:', e.message); }

  console.log(`👤 [FB Profile] Name: "${name}" | Pic: ${profilePic ? 'YES' : 'NO'}`);
  return { name, profilePic };
}

export default function createFacebookRoutes({ auth, sessionManager }) {
  const router = Router();

  // Connect to Facebook — slot-aware
  router.post('/facebook/connect', ...auth, async (req, res) => {
    try {
      const slot = parseInt(req.body.slot) || 0;
      console.log(`🔗 [FB] Connect request for slot ${slot} (user ${req.userId.substring(0, 8)})`);

      if (req.groupWorker.browser) {
        try { await req.groupWorker.close(); } catch (e) { }
        sessionManager.registerBrowserClose();
      }

      req.groupWorker.setProfileSlot(slot);
      sessionManager.setActiveSlot(req.userId, slot);

      let retries = 2;
      let lastError = null;
      while (retries > 0) {
        try { await req.groupWorker.initialize('chrome'); break; }
        catch (initErr) {
          lastError = initErr; retries--;
          console.error(`Browser init failed (${retries} retries left):`, initErr.message);
          try { if (req.groupWorker.browser) await req.groupWorker.browser.close(); } catch (e) { }
          req.groupWorker.browser = null; req.groupWorker.page = null;
          if (retries > 0) await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!req.groupWorker.browser || !req.groupWorker.page) throw lastError || new Error('Browser initialization failed');
      sessionManager.registerBrowserStart();

      await req.groupWorker.page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));

      try {
        const clicked = await req.groupWorker.page.evaluate(() => {
          const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
          for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ดำเนินการต่อ' || text === 'Continue' || text === 'Log Into' || text === 'เข้าสู่ระบบ') { btn.click(); return text; } }
          return null;
        });
        if (clicked) { console.log(`🔗 [FB] Auto-clicked "${clicked}" on profile chooser`); await new Promise(r => setTimeout(r, 3000)); }
      } catch (e) { /* non-critical */ }

      res.json({ success: true, message: 'Browser opened - Please login to Facebook', status: 'pending_login', slot });
    } catch (error) {
      console.error('Facebook connect error:', error.message);
      try { if (req.groupWorker.browser) await req.groupWorker.browser.close(); } catch (e) { }
      req.groupWorker.browser = null; req.groupWorker.page = null;
      res.status(500).json({ success: false, error: `เชื่อมต่อไม่ได้: ${error.message}` });
    }
  });

  // Auto-login to Facebook (for VPS headless mode)
  router.post('/facebook/auto-login', ...auth, async (req, res) => {
    const _loginTimeout = setTimeout(() => {
      if (!res.headersSent) { console.warn(`⏱️ [auto-login] Timed out after 90s`); res.json({ success: false, error: 'Login หมดเวลา (90s) — กรุณาลองใหม่อีกครั้ง' }); }
    }, 90000);
    res.on('finish', () => clearTimeout(_loginTimeout));

    try {
      const { email, password } = req.body;
      if (!email || !password) return res.json({ success: false, error: 'กรุณากรอก Email และ Password' });
      if (!req.groupWorker.browser || !req.groupWorker.page) return res.json({ success: false, error: 'Browser ยังไม่เปิด กรุณากด "เชื่อมต่อ" ก่อน' });

      const page = req.groupWorker.page;
      const shortId = req.userId.substring(0, 8);

      console.log(`🔑 [${shortId}] Auto-login: navigating to facebook.com...`);
      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));

      const initialTitle = await page.title().catch(() => '');
      console.log(`🔑 [${shortId}] Page title: "${initialTitle}" | URL: ${page.url()}`);

      // Handle profile chooser page
      try {
        const hasProfileChooser = await page.evaluate(() => {
          const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
          for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ดำเนินการต่อ' || text === 'Continue') return true; }
          return false;
        }).catch(() => false);

        if (hasProfileChooser) {
          const activeSlotForCreds = sessionManager.getActiveSlot(req.userId);
          const storedCreds = sessionManager.loadFbCredentials(req.userId, activeSlotForCreds);
          const isSameAccount = storedCreds && storedCreds.email && storedCreds.email.toLowerCase().trim() === email.toLowerCase().trim();

          if (isSameAccount) {
            console.log(`🔑 [${shortId}] Profile chooser: same account → clicking "ดำเนินการต่อ"`);
            await page.evaluate(() => { const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]'); for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return; } } });
            await new Promise(r => setTimeout(r, 5000));
          } else {
            console.log(`🔑 [${shortId}] Profile chooser: different account → clicking "ใช้โปรไฟล์อื่น"`);
            const clickedOther = await page.evaluate(() => {
              const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
              for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ใช้โปรไฟล์อื่น' || text === 'Use other account' || text === 'Not you?' || text === 'Log Into Another Account') { btn.click(); return text; } }
              return null;
            });
            if (clickedOther) { console.log(`🔑 [${shortId}] Clicked "${clickedOther}"`); await new Promise(r => setTimeout(r, 4000)); }
            else {
              console.log(`🔑 [${shortId}] Fallback → clicking "ดำเนินการต่อ"`);
              await page.evaluate(() => { const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]'); for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return; } } });
              await new Promise(r => setTimeout(r, 5000));
            }
          }
        }
      } catch (e) { console.log(`⚠️ [${shortId}] Profile chooser handling error:`, e.message); }

      // Check if already logged in
      const alreadyLoggedIn = await page.evaluate(() => {
        return !document.querySelector('input[name="email"]') && !document.querySelector('input[name="pass"]') && !document.querySelector('#email') && !document.querySelector('#pass');
      }).catch(() => false);

      if (alreadyLoggedIn) {
        console.log(`🔑 [${shortId}] Already logged in!`);
        const activeSlot = sessionManager.getActiveSlot(req.userId);
        const userInfo = await scrapeFbUserInfo(page);
        const fbName = userInfo.name || 'Facebook User';
        sessionManager.setFbSession(req.userId, activeSlot, { name: fbName, profilePic: userInfo.profilePic || '' });
        sessionManager.saveFbCredentials(req.userId, activeSlot, email, password);
        return res.json({ success: true, message: `Login สำเร็จ! ${fbName}`, slot: activeSlot, user: { name: fbName, profilePic: userInfo.profilePic || '' } });
      }

      // Handle cookie consent
      try {
        const cookieSelectors = ['button[data-cookiebanner="accept_button"]', 'button[title="Allow all cookies"]', 'button[title="อนุญาตคุกกี้ทั้งหมด"]', 'button[value="1"][name="accept"]', '[data-testid="cookie-policy-manage-dialog-accept-button"]'];
        for (const sel of cookieSelectors) { const btn = await page.$(sel); if (btn) { await btn.click().catch(() => {}); await new Promise(r => setTimeout(r, 2000)); break; } }
      } catch (e) { }

      // Fill email
      const emailSelectors = ['#email', 'input[name="email"]', '#m_login_email', 'input[type="email"]'];
      let emailInput = null;
      for (const sel of emailSelectors) { try { emailInput = await page.waitForSelector(sel, { timeout: 5000, visible: true }); if (emailInput) break; } catch (e) { } }
      if (!emailInput) { await new Promise(r => setTimeout(r, 3000)); for (const sel of emailSelectors) { emailInput = await page.$(sel); if (emailInput) break; } }
      if (!emailInput) return res.json({ success: false, error: 'ไม่พบช่องกรอก Email — Facebook อาจ block หน้า Login' });

      await emailInput.click({ clickCount: 3 }).catch(() => {}); await new Promise(r => setTimeout(r, 200));
      await page.keyboard.press('Backspace').catch(() => {}); await new Promise(r => setTimeout(r, 200));
      await emailInput.type(email, { delay: 80 }); await new Promise(r => setTimeout(r, 500));

      // Fill password
      const passSelectors = ['#pass', 'input[name="pass"]', '#m_login_password', 'input[type="password"]'];
      let passInput = null;
      for (const sel of passSelectors) { passInput = await page.$(sel); if (passInput) break; }
      if (!passInput) return res.json({ success: false, error: 'ไม่พบช่องกรอก Password' });

      await passInput.click({ clickCount: 3 }).catch(() => {}); await new Promise(r => setTimeout(r, 200));
      await page.keyboard.press('Backspace').catch(() => {}); await new Promise(r => setTimeout(r, 200));
      await passInput.type(password, { delay: 80 }); await new Promise(r => setTimeout(r, 500));

      // Click login button
      const btnSelectors = ['button[name="login"]', '#loginbutton', 'button[type="submit"]', 'input[name="login"]', 'button[data-testid="royal_login_button"]'];
      let clicked = false;
      for (const sel of btnSelectors) { try { const btn = await page.$(sel); if (btn) { await page.evaluate(el => el.click(), btn); clicked = true; break; } } catch (e) { } }
      if (!clicked) { try { await passInput.press('Enter'); clicked = true; } catch (e) { } }
      if (!clicked) return res.json({ success: false, error: 'ไม่สามารถกดปุ่ม Login ได้' });

      // Wait for navigation
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        new Promise(r => setTimeout(r, 12000)),
      ]);

      const postLoginUrl = page.url();
      const postLoginTitle = await page.title().catch(() => '');
      console.log(`🔑 [${shortId}] Post-login URL: ${postLoginUrl}`);

      // Handle post-login "ดำเนินการต่อ"
      try {
        const postLoginClicked = await page.evaluate(() => {
          const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
          for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ดำเนินการต่อ' || text === 'Continue') { btn.click(); return text; } }
          return null;
        });
        if (postLoginClicked) { console.log(`🔑 [${shortId}] Post-login: clicked "${postLoginClicked}"`); await new Promise(r => setTimeout(r, 4000)); }
      } catch (e) { /* non-critical */ }

      // Check outcomes
      const checkpointPatterns = ['checkpoint', 'two_step_verification', 'recover', 'captcha', 'login/identify', 'login_attempt', 'confirmemail', 'approve', 'accountquality'];
      if (checkpointPatterns.some(p => postLoginUrl.includes(p))) {
        try { await page.screenshot({ path: `data/debug-checkpoint-${shortId}.png`, fullPage: false }); } catch {}
        return res.json({ success: false, error: 'Facebook ต้องการยืนยันตัวตน (2FA/Checkpoint) — กรุณาลองเปิดหน้าต่าง Browser ด้วยตนเอง' });
      }

      // DOM-based analysis
      const pageAnalysis = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const bodyLower = body.toLowerCase();
        const verificationKeywords = ['enter the code', 'ใส่รหัส', 'รหัสยืนยัน', 'verification code', 'approve this login', 'อนุมัติการเข้าสู่ระบบ', 'check your email', 'ตรวจสอบอีเมล', 'suspicious login', 'การเข้าสู่ระบบที่น่าสงสัย', 'recognize this device', 'จำอุปกรณ์นี้', 'one-time password', 'two-factor', 'authenticator', 'we need to confirm', 'เราต้องยืนยัน', 'account has been locked', 'บัญชีถูกล็อค', 'identity confirmation', 'ยืนยันตัวตน', 'trust this browser', 'เชื่อถือเบราว์เซอร์นี้'];
        const isVerification = verificationKeywords.some(kw => bodyLower.includes(kw));

        const errorSelectors = ['#login_error', '.login_error_box', '[data-sigil="m_login_notice"]', '[role="alert"]', '._9ay7', '.uiBoxRed', '._585n', '._585p', '[data-testid="royal_login_form_error"]', 'div[class*="error"]', 'div[class*="Error"]'];
        let errorText = '';
        for (const sel of errorSelectors) { const el = document.querySelector(sel); if (el && el.textContent?.trim()) { errorText = el.textContent.trim(); break; } }

        const hasVisibleLoginForm = (() => {
          const emailEl = document.querySelector('input[name="email"], #email');
          const passEl = document.querySelector('input[name="pass"], #pass');
          if (emailEl) { const rect = emailEl.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) return true; }
          if (passEl) { const rect = passEl.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) return true; }
          return false;
        })();

        return { isVerification, errorText: errorText.substring(0, 300), hasVisibleLoginForm, bodySnippet: body.substring(0, 500), title: document.title || '' };
      }).catch(() => ({ isVerification: false, errorText: '', hasVisibleLoginForm: true, bodySnippet: '', title: '' }));

      if (pageAnalysis.isVerification) {
        try { await page.screenshot({ path: `data/debug-verify-${shortId}.png`, fullPage: false }); } catch {}
        return res.json({ success: false, error: 'Facebook ต้องการยืนยันตัวตน — อาจต้องกรอกรหัสจาก SMS/Email หรืออนุมัติจากอุปกรณ์อื่น กรุณาเปิด Browser ด้วยตนเอง' });
      }
      if (pageAnalysis.errorText) return res.json({ success: false, error: pageAnalysis.errorText });
      if (pageAnalysis.hasVisibleLoginForm) {
        try { await page.screenshot({ path: `data/debug-loginfail-${shortId}.png`, fullPage: false }); } catch {}
        return res.json({ success: false, error: 'Login ไม่สำเร็จ — รหัสผ่านอาจไม่ถูกต้อง หรือ Facebook ต้องการยืนยันตัวตน' });
      }

      // Login successful
      console.log(`✅ [${shortId}] Login successful!`);
      await new Promise(r => setTimeout(r, 3000));

      const activeSlot = sessionManager.getActiveSlot(req.userId);
      const userInfo = await scrapeFbUserInfo(page);

      if (userInfo.name) {
        sessionManager.setFbSession(req.userId, activeSlot, { name: userInfo.name, profilePic: userInfo.profilePic || '' });
      } else {
        sessionManager.setFbSession(req.userId, activeSlot, { name: 'Facebook User', profilePic: userInfo.profilePic || '' });
      }
      sessionManager.saveFbCredentials(req.userId, activeSlot, email, password);

      return res.json({ success: true, message: `Login สำเร็จ!${userInfo.name ? ` ยินดีต้อนรับ ${userInfo.name}` : ''}`, slot: activeSlot, user: { name: userInfo.name || 'Facebook User', profilePic: userInfo.profilePic || '' } });
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('not clickable') || msg.includes('Target closed') || msg.includes('context was destroyed')) console.log('🔇 Auto-login skipped (stale browser)');
      else console.warn('⚠️ Auto-login error:', msg);
      res.json({ success: false, error: `Login ผิดพลาด: ${msg}` });
    }
  });

  // Re-login to Facebook using stored credentials
  router.post('/facebook/re-login', ...auth, async (req, res) => {
    try {
      const { slot } = req.body;
      const targetSlot = typeof slot === 'number' ? slot : sessionManager.getActiveSlot(req.userId);
      const shortId = req.userId.substring(0, 8);

      const creds = sessionManager.loadFbCredentials(req.userId, targetSlot);
      if (!creds || !creds.email || !creds.password) {
        return res.json({ success: false, needCredentials: true, error: 'ไม่มีข้อมูล Email/Password ที่บันทึกไว้สำหรับ Slot นี้ — กรุณากรอก Email และ Password' });
      }

      sessionManager.setActiveSlot(req.userId, targetSlot);

      if (!req.groupWorker.browser || !req.groupWorker.page) {
        console.log(`🔑 [${shortId}] Re-login: initializing browser for slot ${targetSlot}...`);
        try { await req.groupWorker.initialize(); }
        catch (initErr) { return res.json({ success: false, error: `เปิด Browser ไม่สำเร็จ: ${initErr.message}` }); }
      }

      console.log(`🔑 [${shortId}] Re-login slot ${targetSlot}: using stored credentials...`);
      const reloginOk = await sessionManager._autoReloginFb(req.groupWorker, creds.email, creds.password, shortId);

      if (reloginOk) {
        const page = req.groupWorker.page;
        await new Promise(r => setTimeout(r, 2000));
        const userInfo = await scrapeFbUserInfo(page);
        const name = userInfo.name || 'Facebook User';
        sessionManager.setFbSession(req.userId, targetSlot, { name, profilePic: userInfo.profilePic || '' });
        console.log(`✅ [${shortId}] Re-login slot ${targetSlot} successful: ${name}`);
        return res.json({ success: true, message: `เข้าสู่ระบบใหม่สำเร็จ! ${name}`, slot: targetSlot, user: { name, profilePic: userInfo.profilePic || '' } });
      } else {
        console.log(`❌ [${shortId}] Re-login slot ${targetSlot} failed`);
        return res.json({ success: false, error: 'เข้าสู่ระบบใหม่ไม่สำเร็จ — Facebook อาจต้องการยืนยันตัวตน หรือรหัสผ่านเปลี่ยน' });
      }
    } catch (error) {
      console.error('Re-login error:', error.message);
      res.json({ success: false, error: `Re-login ผิดพลาด: ${error.message}` });
    }
  });

  // Session health check
  router.get('/facebook/session-health', ...auth, (req, res) => {
    try {
      const sessions = sessionManager.getFbSessions(req.userId);
      const activeSlot = sessionManager.getActiveSlot(req.userId);
      const now = Date.now();
      const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

      const slotHealth = sessions.map((s, i) => {
        if (!s || !s.name) return { slot: i, connected: false, hasCredentials: false, needsRelogin: false, ageDays: 0 };
        const connectedAt = s.connectedAt ? new Date(s.connectedAt).getTime() : 0;
        const ageMs = connectedAt ? now - connectedAt : Infinity;
        const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000) * 10) / 10;
        const hasCredentials = sessionManager.hasFbCredentials(req.userId, i);
        return { slot: i, connected: true, name: s.name, connectedAt: s.connectedAt, ageDays, hasCredentials, needsRelogin: ageMs > SESSION_MAX_AGE_MS };
      });

      const activeHealth = slotHealth[activeSlot] || { connected: false, needsRelogin: false };
      res.json({ success: true, activeSlot, activeNeedsRelogin: activeHealth.connected && activeHealth.needsRelogin, activeHasCredentials: activeHealth.hasCredentials || false, slots: slotHealth });
    } catch (error) { res.json({ success: false, error: error.message }); }
  });

  // Check Facebook connection status
  router.get('/facebook/status', ...auth, async (req, res) => {
    try {
      const sessions = sessionManager.getFbSessions(req.userId);
      const activeSlot = sessionManager.getActiveSlot(req.userId);

      let liveConnected = false;
      if (req.groupWorker.browser && req.groupWorker.page) {
        try {
          const isLoggedIn = await Promise.race([req.groupWorker.checkLoginQuick(), new Promise(resolve => setTimeout(() => resolve(false), 5000))]);
          if (isLoggedIn) liveConnected = true;
        } catch (e) { /* non-fatal */ }
      }

      const connectedCount = sessions.filter(s => s && s.name).length;
      const firstConnected = sessions.find(s => s && s.name);

      return res.json({
        success: true, connected: liveConnected || connectedCount > 0,
        user: firstConnected ? { name: firstConnected.name, profilePic: firstConnected.profilePic, connectedAt: firstConnected.connectedAt } : null,
        sessions: sessions.map((s, i) => s ? { slot: i, name: s.name, profilePic: s.profilePic, connectedAt: s.connectedAt } : { slot: i, name: null, profilePic: null, connectedAt: null }),
        activeSlot, connectedCount,
        message: liveConnected ? 'เชื่อมต่อ Facebook สำเร็จ' : (connectedCount > 0 ? `มี ${connectedCount} session ที่เชื่อมต่อ` : 'ยังไม่ได้เชื่อมต่อ Facebook'),
      });
    } catch (error) { res.json({ success: true, connected: false, sessions: [], activeSlot: 0, connectedCount: 0, message: 'ยังไม่ได้เชื่อมต่อ Facebook' }); }
  });

  // Disconnect a specific Facebook session slot
  router.post('/facebook/disconnect', ...auth, async (req, res) => {
    try {
      const slot = parseInt(req.body.slot ?? sessionManager.getActiveSlot(req.userId));
      console.log(`🔌 [FB] Disconnect slot ${slot} (user ${req.userId.substring(0, 8)})`);

      const isActiveSlot = slot === sessionManager.getActiveSlot(req.userId);

      if (isActiveSlot && req.groupWorker.browser && req.groupWorker.page) {
        try {
          const client = await req.groupWorker.page.target().createCDPSession();
          await client.send('Network.clearBrowserCookies');
          await client.send('Network.clearBrowserCache');
          console.log('🍪 Cleared Facebook cookies & cache');
        } catch (e) { console.log('⚠️ Cookie clear failed (non-fatal):', e.message); }
        await req.groupWorker.close();
        sessionManager.registerBrowserClose();
      } else {
        const profileDir = path.join(process.cwd(), 'profiles', req.userId, `fb-session-${slot}`);
        const cookiesPath = path.join(profileDir, 'Default', 'Cookies');
        const cookiesJournalPath = path.join(profileDir, 'Default', 'Cookies-journal');
        try {
          const fs = await import('fs');
          if (fs.existsSync(cookiesPath)) { fs.unlinkSync(cookiesPath); console.log(`🍪 Deleted cookies for slot ${slot}`); }
          if (fs.existsSync(cookiesJournalPath)) fs.unlinkSync(cookiesJournalPath);
        } catch (e) { console.log('⚠️ Profile cookie delete failed (non-fatal):', e.message); }
      }

      sessionManager.clearFbSession(req.userId, slot);
      res.json({ success: true, message: `Logout Session ${slot + 1} สำเร็จ`, slot });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  // Confirm Facebook login (after manual login)
  router.post('/facebook/confirm-login', ...auth, async (req, res) => {
    try {
      if (!req.groupWorker.browser || !req.groupWorker.page) return res.json({ success: false, connected: false, message: 'Browser not ready' });

      const page = req.groupWorker.page;
      const activeSlot = sessionManager.getActiveSlot(req.userId);
      const shortId = req.userId.substring(0, 8);

      try {
        const clickedContinue = await page.evaluate(() => {
          const btns = document.querySelectorAll('[role="button"], button, a, div[tabindex="0"]');
          for (const btn of btns) { const text = (btn.textContent || '').trim(); if (text === 'ดำเนินการต่อ' || text === 'Continue' || text === 'Log Into') { btn.click(); return text; } }
          return null;
        });
        if (clickedContinue) { console.log(`🔗 [confirm-login] [${shortId}] Auto-clicked "${clickedContinue}"`); await new Promise(r => setTimeout(r, 4000)); }
      } catch (e) { /* non-critical */ }

      const hasLoginForm = await page.evaluate(() => {
        return !!(document.querySelector('input[name="email"]') || document.querySelector('input[name="pass"]') || document.querySelector('#email') || document.querySelector('#pass'));
      }).catch(() => true);

      const pageTitle = await page.title().catch(() => '');
      const titleIsLogin = pageTitle.toLowerCase().includes('log in') || pageTitle.toLowerCase().includes('เข้าสู่ระบบ');
      const isLoggedIn = !hasLoginForm && !titleIsLogin;

      if (isLoggedIn) {
        const userInfo = await scrapeFbUserInfo(page);
        const userData = { name: userInfo.name || 'Facebook User', profilePic: userInfo.profilePic || '', connectedAt: new Date().toISOString() };
        sessionManager.setFbSession(req.userId, activeSlot, userData);
        console.log(`✅ [confirm-login] [${shortId}] Saved: "${userData.name}" (slot ${activeSlot})`);
        res.json({ success: true, connected: true, user: userData, slot: activeSlot, message: 'เชื่อมต่อ Facebook สำเร็จ!' });
      } else {
        res.json({ success: false, connected: false, message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดอยู่' });
      }
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  return router;
}
