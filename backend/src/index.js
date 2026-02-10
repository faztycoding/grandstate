import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import { sessionManager } from './services/userSessionManager.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (behind Nginx reverse proxy)
app.set('trust proxy', 1);

// CORS — lock to allowed origins
const ALLOWED_ORIGINS = [
  ...(process.env.FRONTEND_URL || 'http://localhost:8080').split(',').map(s => s.trim()),
  'https://grandstate.io',
  'https://www.grandstate.io',
  'http://localhost:8080',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', apiLimiter);

// Session middleware — runs after auth, attaches per-user session to req
function attachSession(req, res, next) {
  const session = sessionManager.getSession(req.userId);
  req.session = session;
  req.groupWorker = session.groupWorker;
  req.marketplaceWorker = session.marketplaceWorker;
  req.postingTracker = session.postingTracker;
  req.scheduler = session.scheduler;
  next();
}

// Combine auth + session into one middleware array
const auth = [authMiddleware, attachSession];

// Health endpoint (no auth required)
app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'Grand$tate API is running', sessions: sessionManager.getStats() });
});

// API Endpoints

// ============================================
// POSTING TRACKER ENDPOINTS
// ============================================

// Today's stats (daily usage, limit, next reset)
app.get('/api/posting/today', ...auth, (req, res) => {
  const { userPackage } = req.query;
  res.json({ success: true, ...req.postingTracker.getTodayStats(userPackage || 'free') });
});

// Pre-flight check before starting automation
app.post('/api/posting/preflight', ...auth, (req, res) => {
  const { propertyId, groupIds, userPackage } = req.body;
  if (!propertyId || !groupIds) {
    return res.status(400).json({ success: false, error: 'propertyId and groupIds required' });
  }
  const result = req.postingTracker.preflightCheck(propertyId, groupIds, userPackage || 'free');
  res.json({ success: true, ...result });
});

// Daily history (last N days)
app.get('/api/posting/history', ...auth, (req, res) => {
  const { days } = req.query;
  res.json({ success: true, days: req.postingTracker.getDailyHistory(parseInt(days) || 7) });
});

// Full posting history
app.get('/api/posting-history', ...auth, (req, res) => {
  res.json({ success: true, history: req.postingTracker.getHistory() });
});

// Property-specific posting history
app.get('/api/posting-history/:propertyId', ...auth, (req, res) => {
  const { propertyId } = req.params;
  res.json({ 
    success: true, 
    history: req.postingTracker.getPropertyHistory(propertyId) 
  });
});

// Available groups (not yet posted today)
app.get('/api/available-groups/:propertyId', ...auth, (req, res) => {
  const { propertyId } = req.params;
  const { groupIds, cooldownHours } = req.query;
  
  const allGroupIds = groupIds ? groupIds.split(',') : [];
  const available = req.postingTracker.filterAvailableGroups(
    propertyId, 
    allGroupIds, 
    parseInt(cooldownHours) || 24
  );
  
  res.json({ success: true, availableGroups: available });
});

// Fetch Facebook Group Info (name, member count)
app.post('/api/groups/fetch-info', ...auth, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('facebook.com/groups')) {
      return res.status(400).json({ success: false, error: 'Invalid Facebook group URL' });
    }

    const groupWorker = req.groupWorker;

    // Initialize browser if needed
    if (!req.groupWorker.browser || !req.groupWorker.browser.isConnected()) {
      if (!sessionManager.canStartBrowser()) {
        return res.status(429).json({ success: false, error: 'Server busy — too many active browsers. Please try again later.' });
      }
      await req.groupWorker.initialize();
      sessionManager.registerBrowserStart();
    }

    const page = req.groupWorker.page;
    
    // Navigate to the group's ABOUT page to get activity info
    // Convert URL to /about page: https://www.facebook.com/groups/XXX -> https://www.facebook.com/groups/XXX/about
    let aboutUrl = url.replace(/\/$/, ''); // Remove trailing slash
    if (!aboutUrl.includes('/about')) {
      aboutUrl = aboutUrl + '/about';
    }
    
    console.log('Fetching group info from:', aboutUrl);
    await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to fully load (about page needs more time)
    await new Promise(r => setTimeout(r, 4000));
    
    // Try to extract group name and member count
    const groupInfo = await page.evaluate(() => {
      let name = '';
      let memberCount = 0;

      // Blacklist: texts that are NOT group names (FB UI elements)
      const blacklist = [
        'การแจ้งเตือน', 'แชท', 'Chat', 'Notifications', 'Messenger',
        'Facebook', 'หน้าหลัก', 'Home', 'Watch', 'Marketplace',
        'สร้าง', 'Create', 'เมนู', 'Menu',
      ];
      const isBlacklisted = (text) => blacklist.some(b => text === b || text.startsWith(b + ' '));

      // ======= FIND GROUP NAME =======
      // Strategy 1 (BEST): og:title meta tag — most reliable
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        const ogText = ogTitle.getAttribute('content')?.trim() || '';
        if (ogText && ogText.length > 2 && !isBlacklisted(ogText)) {
          name = ogText;
        }
      }

      // Strategy 2: <title> tag — "GroupName | Facebook"
      if (!name) {
        const title = document.title || '';
        if (title.includes('|')) {
          const candidate = title.split('|')[0].trim();
          if (candidate && candidate.length > 2 && !isBlacklisted(candidate)) {
            name = candidate;
          }
        } else if (title.includes('-')) {
          const candidate = title.split('-')[0].trim();
          if (candidate && candidate.length > 2 && !isBlacklisted(candidate)) {
            name = candidate;
          }
        }
      }

      // Strategy 3: h1 > span — skip blacklisted texts
      if (!name) {
        const h1Elements = document.querySelectorAll('h1');
        for (const h1 of h1Elements) {
          const span = h1.querySelector('span');
          const text = span ? (span.textContent?.trim() || '') : (h1.textContent?.trim() || '');
          if (text && text.length > 2 && !isBlacklisted(text)) {
            name = text;
            break;
          }
        }
      }
      
      // Strategy 4: aria-label on group header links
      if (!name) {
        const groupLinks = document.querySelectorAll('a[href*="/groups/"]');
        for (const link of groupLinks) {
          const ariaLabel = link.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.length > 5 && !isBlacklisted(ariaLabel)) {
            name = ariaLabel;
            break;
          }
        }
      }
      
      // ======= FIND MEMBER COUNT =======
      const bodyText = document.body.innerText;
      let match;
      
      // Helper: parse Thai unit multiplier
      const thaiUnits = { 'พัน': 1000, 'หมื่น': 10000, 'แสน': 100000, 'ล้าน': 1000000 };
      
      // ── Thai: "สมาชิก X.X [หมื่น/แสน/ล้าน/พัน]" (สมาชิก comes first)
      match = bodyText.match(/สมาชิก\s*([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)/);
      if (match) {
        memberCount = Math.round(parseFloat(match[1].replace(',', '.')) * (thaiUnits[match[2]] || 1));
      }
      
      // ── Thai: "X.X [หมื่น/แสน/ล้าน/พัน] สมาชิก" (number comes first)
      if (!memberCount) {
        match = bodyText.match(/([\d.,]+)\s*(พัน|หมื่น|แสน|ล้าน)\s*(?:คน\s*)?สมาชิก/);
        if (match) {
          memberCount = Math.round(parseFloat(match[1].replace(',', '.')) * (thaiUnits[match[2]] || 1));
        }
      }
      
      // ── Thai: "สมาชิก X,XXX คน" (plain number with คน)
      if (!memberCount) {
        match = bodyText.match(/สมาชิก\s*([\d,]+)\s*คน/);
        if (match) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // ── Thai: "สมาชิก X,XXX" (plain number without คน)
      if (!memberCount) {
        match = bodyText.match(/สมาชิก\s*([\d,]+)/);
        if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // ── Thai: "X,XXX สมาชิก" (number before สมาชิก)
      if (!memberCount) {
        match = bodyText.match(/([\d,]+)\s*สมาชิก/);
        if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // ── English: "X.XK members" or "XK members"
      if (!memberCount) {
        match = bodyText.match(/([\d.]+)\s*[Kk]\s*members/i);
        if (match) {
          memberCount = Math.round(parseFloat(match[1]) * 1000);
        }
      }
      
      // ── English: "X.XM members"
      if (!memberCount) {
        match = bodyText.match(/([\d.]+)\s*[Mm]\s*members/i);
        if (match) {
          memberCount = Math.round(parseFloat(match[1]) * 1000000);
        }
      }
      
      // ── English: "X,XXX members" (plain number)
      if (!memberCount) {
        match = bodyText.match(/([\d,]+)\s*members/i);
        if (match && parseInt(match[1].replace(/,/g, '')) > 0) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // ── English: "X,XXX total members"
      if (!memberCount) {
        match = bodyText.match(/([\d,]+)\s*total\s*members/i);
        if (match) {
          memberCount = parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // ======= FIND POSTS TODAY & LAST MONTH FROM ACTIVITY SECTION =======
      let postsToday = 0;
      let postsLastMonth = 0;
      
      // Search all spans with specific Facebook class patterns
      // Example: <span class="x193iq5w xeuugli...">780 โพสต์ใหม่ในวันนี้</span>
      const allSpans = document.querySelectorAll('span');
      
      // DEBUG: Log all span texts that contain numbers to help diagnose
      const debugTexts = [];
      
      allSpans.forEach(span => {
        const text = span.textContent?.trim() || '';
        
        // Collect texts that look like post counts for debugging
        if (text.match(/\d+/) && (text.includes('โพสต์') || text.includes('post'))) {
          debugTexts.push(text);
        }
        
        // Match: "XXX โพสต์ใหม่ในวันนี้" (supports comma in numbers like 1,234)
        // RELAXED: removed ^ and $ to allow extra whitespace
        if (!postsToday) {
          const todayMatch = text.match(/([\d,]+)\s*โพสต์ใหม่ในวันนี้/);
          if (todayMatch) {
            postsToday = parseInt(todayMatch[1].replace(/,/g, ''));
          }
        }
        
        // Match: "X,XXX โพสต์ในเดือนที่ผ่านมา"
        // RELAXED: removed ^ and $ to allow extra whitespace
        if (!postsLastMonth) {
          const monthMatch = text.match(/([\d,]+)\s*โพสต์ในเดือนที่ผ่านมา/);
          if (monthMatch) {
            postsLastMonth = parseInt(monthMatch[1].replace(/,/g, ''));
          }
        }
        
        // English: "XXX new posts today" (RELAXED)
        if (!postsToday) {
          const todayEnMatch = text.match(/([\d,]+)\s*new posts? today/i);
          if (todayEnMatch) {
            postsToday = parseInt(todayEnMatch[1].replace(/,/g, ''));
          }
        }
        
        // English: "X,XXX posts in the last month" (RELAXED)
        if (!postsLastMonth) {
          const monthEnMatch = text.match(/([\d,]+)\s*posts? in the last month/i);
          if (monthEnMatch) {
            postsLastMonth = parseInt(monthEnMatch[1].replace(/,/g, ''));
          }
        }
      });
      
      // Fallback: Search in bodyText if spans didn't work
      if (!postsToday || !postsLastMonth) {
        const postsBodyText = document.body.innerText;
        
        if (!postsToday) {
          const todayBodyMatch = postsBodyText.match(/([\d,]+)\s*โพสต์ใหม่ในวันนี้/);
          if (todayBodyMatch) {
            postsToday = parseInt(todayBodyMatch[1].replace(/,/g, ''));
          }
        }
        
        // English fallback for posts today (RELAXED)
        if (!postsToday) {
          const todayEnBody = postsBodyText.match(/([\d,]+)\s*new posts?\s*today/i);
          if (todayEnBody) {
            postsToday = parseInt(todayEnBody[1].replace(/,/g, ''));
          }
        }
        
        if (!postsLastMonth) {
          const monthBodyMatch = postsBodyText.match(/([\d,]+)\s*โพสต์ในเดือนที่ผ่านมา/);
          if (monthBodyMatch) {
            postsLastMonth = parseInt(monthBodyMatch[1].replace(/,/g, ''));
          }
        }
        
        // English fallback for posts last month (RELAXED)
        if (!postsLastMonth) {
          const monthEnBody = postsBodyText.match(/([\d,]+)\s*posts?\s*in\s*the\s*last\s*month/i);
          if (monthEnBody) {
            postsLastMonth = parseInt(monthEnBody[1].replace(/,/g, ''));
          }
        }
        
        // Match: "สมาชิกทั้งหมด XX,XXX ราย" (more accurate member count)
        const totalMemberMatch = postsBodyText.match(/สมาชิกทั้งหมด\s*([\d,]+)\s*ราย/);
        if (totalMemberMatch) {
          memberCount = parseInt(totalMemberMatch[1].replace(/,/g, ''));
        }
      }
      
      // Clean name: remove "(N) " notification count prefix from FB page titles
      if (name) {
        name = name.replace(/^\(\d+\)\s*/, '').trim();
      }

      return { name, memberCount, postsToday, postsLastMonth, debugTexts };
    });
    
    // Debug logging
    if (groupInfo.debugTexts && groupInfo.debugTexts.length > 0) {
      console.log(`🔍 Debug: Found ${groupInfo.debugTexts.length} span texts with numbers + 'post/โพสต์':`);
      console.log(groupInfo.debugTexts.slice(0, 10)); // Show first 10 matches
    }
    console.log(`📊 Scraped: ${groupInfo.name?.substring(0, 40)} | Members: ${groupInfo.memberCount} | Today: ${groupInfo.postsToday} | Month: ${groupInfo.postsLastMonth}`);
    
    // Browser stays open for reuse by this user's session
    
    res.json({ 
      success: true, 
      groupInfo: {
        name: groupInfo.name || '',
        memberCount: groupInfo.memberCount || 0,
        postsToday: groupInfo.postsToday || 0,
        postsLastMonth: groupInfo.postsLastMonth || 0,
        url: url,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Fetch group info error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// Group Posting Automation Endpoints
// ====================================

// Start group posting automation
// Captions are auto-generated on backend based on group count
app.post('/api/group-automation/start', ...auth, async (req, res) => {
  try {
    const { property, groups, images, delayMinutes, delaySeconds, claudeApiKey, browser, userPackage } = req.body;

    if (!property) {
      return res.status(400).json({ success: false, error: 'Property is required' });
    }
    if (!groups || groups.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one group is required' });
    }

    // Validate post limit based on package
    const packageLimits = { free: 10, agent: 300, elite: 750 };
    const limit = packageLimits[userPackage] || 10;
    if (groups.length > limit) {
      return res.status(400).json({ 
        success: false, 
        error: `Package ${userPackage} limit exceeded`,
        message: `แพ็กเกจ ${userPackage.toUpperCase()} จำกัด ${limit} โพสต์/วัน คุณเลือก ${groups.length} กลุ่ม`
      });
    }

    // Initialize Claude API if key provided
    if (claudeApiKey) {
      req.groupWorker.initAnthropicClient(claudeApiKey);
    }

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
      } catch (err) {
        console.error(`Caption gen ${i + 1} failed:`, err.message);
      }
    }

    // Fallback: if no captions generated, use property description
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

    // Start automation in background
    const result = await req.groupWorker.startAutomation({
      property,
      groups,
      caption: generatedCaptions[0],
      captions: generatedCaptions,
      captionAssignments,
      images: images || property.images || [],
      delayMinutes: delayMinutes || undefined,
      delaySeconds: delaySeconds || undefined,
      captionStyle,
      browser: browser || 'chrome',
      userPackage: userPackage || 'free',
    });

    // Include generated captions in response for TaskProgress display
    result.generatedCaptions = generatedCaptions;

    res.json(result);
  } catch (error) {
    console.error('Group automation start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get automation status
app.get('/api/group-automation/status', ...auth, (req, res) => {
  try {
    const status = req.groupWorker.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause automation
app.post('/api/group-automation/pause', ...auth, (req, res) => {
  try {
    req.groupWorker.pause();
    res.json({ success: true, message: 'Automation paused' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume automation
app.post('/api/group-automation/resume', ...auth, (req, res) => {
  try {
    req.groupWorker.resume();
    res.json({ success: true, message: 'Automation resumed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop automation
app.post('/api/group-automation/stop', ...auth, async (req, res) => {
  try {
    await req.groupWorker.stop();
    res.json({ success: true, message: 'Automation stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close browser
app.post('/api/group-automation/close', ...auth, async (req, res) => {
  try {
    await req.groupWorker.close();
    res.json({ success: true, message: 'Browser closed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize browser (for pre-login)
app.post('/api/group-automation/init', ...auth, async (req, res) => {
  try {
    await req.groupWorker.initialize();
    res.json({ success: true, message: 'Browser initialized - Please login to Facebook' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check login status
app.get('/api/group-automation/check-login', ...auth, async (req, res) => {
  try {
    if (!req.groupWorker.browser) {
      await req.groupWorker.initialize();
    }
    const isLoggedIn = await req.groupWorker.checkLogin();
    res.json({ success: true, isLoggedIn });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate caption using Claude API
// Supports package-based prompts and required caption count
app.post('/api/group-automation/generate-caption', ...auth, async (req, res) => {
  try {
    const { property, style, claudeApiKey, userPackage = 'free', requiredCaptions = 1 } = req.body;

    if (claudeApiKey) {
      req.groupWorker.initAnthropicClient(claudeApiKey);
    }

    console.log(`📝 Generate caption request - Package: ${userPackage}, Required: ${requiredCaptions}`);
    
    // Generate multiple captions based on required count
    const allCaptions = [];
    
    for (let i = 0; i < requiredCaptions; i++) {
      const caption = await req.groupWorker.generateCaption(property, style || 'friendly', userPackage);
      allCaptions.push(caption);
    }
    
    // allCaptions is already an array of individual captions — use directly
    const fullResponse = allCaptions.join('\n\n---\n\n');
    
    res.json({ 
      success: true, 
      caption: fullResponse,           // Full response (joined)
      captions: allCaptions,           // Array of individual captions
      package: userPackage,
      captionCount: allCaptions.length,
      requiredCaptions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// Facebook Connection Endpoints
// ====================================

// Connect to Facebook (opens browser for login)
app.post('/api/facebook/connect', ...auth, async (req, res) => {
  try {
    // Initialize browser with retry
    let retries = 2;
    let lastError = null;
    while (retries > 0) {
      try {
        await req.groupWorker.initialize('chrome');
        break;
      } catch (initErr) {
        lastError = initErr;
        retries--;
        console.error(`Browser init failed (${retries} retries left):`, initErr.message);
        // Clean up before retry
        try { if (req.groupWorker.browser) await req.groupWorker.browser.close(); } catch(e) {}
        req.groupWorker.browser = null;
        req.groupWorker.page = null;
        if (retries > 0) await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    if (!req.groupWorker.browser || !req.groupWorker.page) {
      throw lastError || new Error('Browser initialization failed');
    }
    
    // Navigate to Facebook
    await req.groupWorker.page.goto('https://www.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    res.json({ 
      success: true, 
      message: 'Browser opened - Please login to Facebook',
      status: 'pending_login'
    });
  } catch (error) {
    console.error('Facebook connect error:', error.message);
    // Clean up on failure
    try { if (req.groupWorker.browser) await req.groupWorker.browser.close(); } catch(e) {}
    req.groupWorker.browser = null;
    req.groupWorker.page = null;
    res.status(500).json({ success: false, error: `เชื่อมต่อไม่ได้: ${error.message}` });
  }
});

// Check Facebook connection status
app.get('/api/facebook/status', ...auth, async (req, res) => {
  try {
    // Check if browser exists and is logged in
    if (!req.groupWorker.browser) {
      return res.json({ 
        success: true, 
        connected: false, 
        message: 'ยังไม่ได้เชื่อมต่อ Facebook' 
      });
    }
    
    // Check if logged in
    const isLoggedIn = await req.groupWorker.checkLogin();
    
    if (isLoggedIn) {
      // Get user info - scrape real name & profile pic from Facebook nav
      const userInfo = await req.groupWorker.page.evaluate(() => {
        let name = '';
        let profilePic = '';
        
        try {
          // Method 1: Find profile link in navigation list items
          // Facebook shows user profile in left sidebar or account menu
          const allLinks = document.querySelectorAll('a[role="link"][href*="facebook.com/"]');
          for (const link of allLinks) {
            const img = link.querySelector('image');
            const nameSpan = link.querySelector('span.x1lliihq');
            if (img && nameSpan) {
              const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
              const text = nameSpan.textContent?.trim() || '';
              if (href.includes('scontent') && text.length > 1 && text.length < 60) {
                name = text;
                profilePic = href;
                break;
              }
            }
          }
          
          // Method 2: Try account menu / profile shortcut
          if (!name) {
            const profileLinks = document.querySelectorAll('a[href*="/me/"], a[aria-label*="profile"], a[aria-label*="โปรไฟล์"]');
            for (const link of profileLinks) {
              const text = link.textContent?.trim();
              if (text && text.length > 1 && text.length < 60 && !text.includes('Facebook')) {
                name = text;
                break;
              }
            }
          }
          
          // Method 3: Get profile pic from any navigation image
          if (!profilePic) {
            const images = document.querySelectorAll('image[*|href*="scontent"]');
            for (const img of images) {
              const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
              if (href.includes('scontent') && (href.includes('_s40x40') || href.includes('_s36x36') || href.includes('dst-jpg'))) {
                profilePic = href;
                break;
              }
            }
          }
        } catch (e) {
          console.error('Error scraping FB user info:', e.message);
        }
        
        return { name, profilePic };
      });
      
      return res.json({ 
        success: true, 
        connected: true, 
        user: {
          name: userInfo.name || 'Facebook User',
          profilePic: userInfo.profilePic || '',
          connectedAt: new Date().toISOString(),
        },
        message: 'เชื่อมต่อ Facebook สำเร็จ'
      });
    }
    
    res.json({ 
      success: true, 
      connected: false, 
      message: 'ยังไม่ได้ Login Facebook' 
    });
  } catch (error) {
    res.json({ 
      success: true, 
      connected: false, 
      message: 'ยังไม่ได้เชื่อมต่อ Facebook' 
    });
  }
});

// Disconnect Facebook
app.post('/api/facebook/disconnect', ...auth, async (req, res) => {
  try {
    await req.groupWorker.close();
    res.json({ success: true, message: 'ยกเลิกการเชื่อมต่อ Facebook แล้ว' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm Facebook login (after user logs in manually)
app.post('/api/facebook/confirm-login', ...auth, async (req, res) => {
  try {
    if (!req.groupWorker.browser) {
      return res.status(400).json({ success: false, error: 'Browser not open' });
    }
    
    const isLoggedIn = await req.groupWorker.checkLogin();
    
    if (isLoggedIn) {
      // Get user name + profile pic from Facebook page
      const userInfo = await req.groupWorker.page.evaluate(() => {
        let name = '';
        let profilePic = '';
        
        try {
          // Find profile link with image + name span in navigation
          const allLinks = document.querySelectorAll('a[role="link"][href*="facebook.com/"]');
          for (const link of allLinks) {
            const img = link.querySelector('image');
            const nameSpan = link.querySelector('span.x1lliihq');
            if (img && nameSpan) {
              const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
              const text = nameSpan.textContent?.trim() || '';
              if (href.includes('scontent') && text.length > 1 && text.length < 60) {
                name = text;
                profilePic = href;
                break;
              }
            }
          }
          
          // Fallback: try other selectors
          if (!name) {
            const profileLinks = document.querySelectorAll('a[href*="/me/"], a[aria-label*="profile"], a[aria-label*="โปรไฟล์"]');
            for (const link of profileLinks) {
              const text = link.textContent?.trim();
              if (text && text.length > 1 && text.length < 60 && !text.includes('Facebook')) {
                name = text;
                break;
              }
            }
          }
          
          if (!profilePic) {
            const images = document.querySelectorAll('image[*|href*="scontent"]');
            for (const img of images) {
              const href = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
              if (href.includes('scontent') && (href.includes('_s40x40') || href.includes('_s36x36') || href.includes('dst-jpg'))) {
                profilePic = href;
                break;
              }
            }
          }
        } catch (e) {
          console.error('Error scraping FB user info:', e.message);
        }
        
        return { name, profilePic };
      });
      
      res.json({ 
        success: true, 
        connected: true,
        user: {
          name: userInfo.name || 'Facebook User',
          profilePic: userInfo.profilePic || '',
          connectedAt: new Date().toISOString(),
        },
        message: 'เชื่อมต่อ Facebook สำเร็จ!'
      });
    } else {
      res.json({ 
        success: false, 
        connected: false,
        message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดอยู่'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// Marketplace Posting Automation Endpoints
// ====================================

// Start marketplace automation (Marketplace + tick groups in batches of 20)
app.post('/api/marketplace-automation/start', ...auth, async (req, res) => {
  try {
    const { property, groups, caption, images, delayMinutes, delaySeconds, captionStyle, claudeApiKey, browser, userPackage } = req.body;

    if (!property) {
      return res.status(400).json({ success: false, error: 'Property is required' });
    }
    if (!groups || groups.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one group is required' });
    }

    // Validate post limit based on package
    const packageLimits = { free: 10, agent: 300, elite: 750 };
    const limit = packageLimits[userPackage] || 10;
    if (groups.length > limit) {
      return res.status(400).json({
        success: false,
        error: `Package ${userPackage} limit exceeded`,
        message: `แพ็กเกจ ${userPackage.toUpperCase()} จำกัด ${limit} โพสต์/วัน คุณเลือก ${groups.length} กลุ่ม`
      });
    }

    // If groupWorker has an active browser, let marketplace borrow it
    if (req.groupWorker.browser && req.groupWorker.browser.isConnected()) {
      console.log('🔗 Marketplace borrowing browser from req.groupWorker...');
      req.marketplaceWorker.borrowBrowser(req.groupWorker.browser, req.groupWorker.page);
    }

    // Run pre-flight check SYNCHRONOUSLY to return limit errors immediately
    const tracker = req.marketplaceWorker.tracker;
    const preflight = tracker.preflightCheck(
      property.id,
      groups.map(g => g.id),
      userPackage || 'free'
    );

    if (!preflight.canProceed) {
      const reason = preflight.dailyRemaining === 0
        ? `ถึงลิมิตวันนี้แล้ว (${preflight.dailyLimit} โพสต์) รีเซ็ตตี 5`
        : `กลุ่มทั้งหมดถูกโพสต์ไปแล้ววันนี้`;
      return res.json({
        success: false,
        error: reason,
        errorType: 'limit_reached',
        tasks: [],
        dailyStats: tracker.getTodayStats(userPackage || 'free'),
      });
    }

    // Start automation in BACKGROUND — don't await!
    // This lets the HTTP response return immediately so frontend can start polling
    req.marketplaceWorker.startMarketplaceAutomation({
      property,
      groups,
      caption,
      images: images || property.images || [],
      delayMinutes: delayMinutes || undefined,
      delaySeconds: delaySeconds || undefined,
      captionStyle: captionStyle || 'friendly',
      browser: browser || 'chrome',
      userPackage: userPackage || 'free',
      claudeApiKey,
    }).then(result => {
      console.log('✅ Marketplace automation finished:', result.success ? 'SUCCESS' : 'FAILED');
    }).catch(err => {
      console.error('❌ Marketplace automation error:', err.message);
    });

    // Return immediately with "started" response
    res.json({
      success: true,
      message: `เริ่ม automation แล้ว — ${preflight.canPost.length} กลุ่ม (${Math.ceil(preflight.canPost.length / 20)} batches)`,
      skippedDuplicate: preflight.skippedDuplicate.length,
      skippedOverLimit: preflight.skippedOverLimit.length,
      totalGroups: preflight.canPost.length,
    });
  } catch (error) {
    console.error('Marketplace automation start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get marketplace automation status
app.get('/api/marketplace-automation/status', ...auth, (req, res) => {
  try {
    const status = req.marketplaceWorker.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause marketplace automation
app.post('/api/marketplace-automation/pause', ...auth, (req, res) => {
  try {
    req.marketplaceWorker.pause();
    res.json({ success: true, message: 'Marketplace automation paused' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume marketplace automation
app.post('/api/marketplace-automation/resume', ...auth, (req, res) => {
  try {
    req.marketplaceWorker.resume();
    res.json({ success: true, message: 'Marketplace automation resumed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop marketplace automation
app.post('/api/marketplace-automation/stop', ...auth, async (req, res) => {
  try {
    await req.marketplaceWorker.stop();
    res.json({ success: true, message: 'Marketplace automation stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SCHEDULED POSTING API
// ============================================

// Get all schedules
app.get('/api/schedules', ...auth, (req, res) => {
  res.json({ success: true, schedules: req.scheduler.getSchedules() });
});

// Create a new scheduled post
app.post('/api/schedules', ...auth, (req, res) => {
  try {
    const { scheduledAt, mode, property, groups, caption, images, delaySeconds, captionStyle, userPackage, browser } = req.body;
    if (!scheduledAt || !mode || !property || !groups?.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const schedule = req.scheduler.addSchedule({ scheduledAt, mode, property, groups, caption, images, delaySeconds, captionStyle, userPackage, browser });
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel a scheduled post
app.post('/api/schedules/:id/cancel', ...auth, (req, res) => {
  const ok = req.scheduler.cancelSchedule(req.params.id);
  res.json({ success: ok, message: ok ? 'Cancelled' : 'Not found or already running' });
});

// Delete a scheduled post
app.delete('/api/schedules/:id', ...auth, (req, res) => {
  const ok = req.scheduler.deleteSchedule(req.params.id);
  res.json({ success: ok });
});

// ============================================
// ANALYTICS API
// ============================================

// Get posting analytics (aggregated from postingTracker)
app.get('/api/analytics', ...auth, (req, res) => {
  try {
    const { userPackage, days } = req.query;
    const tracker = req.postingTracker;
    const todayStats = tracker.getTodayStats(userPackage || 'free');
    const history = tracker.history || {};
    const archive = history.dailyArchive || {};
    const currentDay = history.currentDay;

    // Build daily data from dailyArchive + today
    const dailyData = [];
    const now = new Date();
    const numDays = parseInt(days) || 7;

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      if (dateStr === currentDay) {
        // Today — use live todayStats
        const ts = history.todayStats || {};
        dailyData.push({
          date: dateStr,
          posts: ts.postsCount || 0,
          success: ts.successCount || 0,
          failed: ts.failedCount || 0,
          groups: ts.groupsPosted?.length || 0,
        });
      } else if (archive[dateStr]) {
        // Archived day
        const a = archive[dateStr];
        dailyData.push({
          date: dateStr,
          posts: a.postsCount || 0,
          success: a.successCount || 0,
          failed: a.failedCount || 0,
          groups: a.groupsPosted?.length || 0,
        });
      } else {
        dailyData.push({ date: dateStr, posts: 0, success: 0, failed: 0, groups: 0 });
      }
    }

    // Group performance from groupStats
    const groupPerformance = [];
    if (history.groupStats) {
      for (const [groupId, stats] of Object.entries(history.groupStats)) {
        groupPerformance.push({
          groupId,
          groupName: stats.name || stats.groupName || groupId,
          totalPosts: stats.totalPosts || 0,
          successCount: stats.successCount || 0,
          failedCount: stats.failedCount || 0,
          lastPosted: stats.lastPosted,
          successRate: stats.totalPosts > 0 ? Math.round(((stats.successCount || 0) / stats.totalPosts) * 100) : 0,
          propertiesCount: stats.properties?.length || 0,
        });
      }
    }

    // Sort by total posts descending
    groupPerformance.sort((a, b) => b.totalPosts - a.totalPosts);

    // Calculate all-time totals from postings array
    const allPostings = history.postings || [];
    const totalPostsAllTime = allPostings.length;
    const totalSuccessAllTime = allPostings.filter(p => p.success).length;
    const totalFailedAllTime = allPostings.filter(p => !p.success).length;

    res.json({
      success: true,
      today: todayStats,
      dailyData,
      groupPerformance: groupPerformance.slice(0, 50),
      summary: {
        totalPostsAllTime,
        totalSuccessAllTime,
        totalFailedAllTime,
        totalGroupsPosted: groupPerformance.length,
        avgSuccessRate: totalPostsAllTime > 0 ? Math.round((totalSuccessAllTime / totalPostsAllTime) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HEALTH CHECK — Real-time risk scoring from actual posting data
// ============================================
app.get('/api/health-check', ...auth, (req, res) => {
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

    // --- Gather today's postings with timestamps ---
    const todayPostings = postings.filter(p => p.day === todayDate);
    const todayTimestamps = todayPostings.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);

    // Posts this hour
    const postsThisHour = todayTimestamps.filter(t => t > oneHourAgo).length;
    const postsToday = todayPostings.length;

    // --- Delays between posts (minutes) ---
    const delays = [];
    for (let i = 1; i < todayTimestamps.length; i++) {
      delays.push((todayTimestamps[i] - todayTimestamps[i - 1]) / 60000);
    }
    const avgDelay = delays.length > 0 ? delays.reduce((s, v) => s + v, 0) / delays.length : -1;
    const minDelay = delays.length > 0 ? Math.min(...delays) : -1;

    // --- Caption diversity (property diversity as proxy) ---
    const todayProperties = new Set(todayPostings.map(p => p.propertyId));
    const uniqueProperties = todayProperties.size;
    const diversityRatio = postsToday > 0 ? uniqueProperties / postsToday : 1;

    // --- Interval coefficient of variation (bot detection) ---
    let intervalCV = -1;
    if (delays.length >= 2) {
      const mean = delays.reduce((s, v) => s + v, 0) / delays.length;
      if (mean > 0) {
        const variance = delays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / delays.length;
        intervalCV = Math.sqrt(variance) / mean;
      } else {
        intervalCV = 0;
      }
    }

    // --- Weekly acceleration ---
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
    let thisWeekCount = 0;
    let lastWeekCount = 0;
    // Count from archive + today
    for (const [dateStr, dayData] of Object.entries(archive)) {
      const dt = new Date(dateStr).getTime();
      if (dt > oneWeekAgo) thisWeekCount += (dayData.postsCount || 0);
      else if (dt > twoWeeksAgo) lastWeekCount += (dayData.postsCount || 0);
    }
    thisWeekCount += postsToday; // add today

    // --- Session duration (from first to last post today) ---
    let sessionMinutes = 0;
    if (todayTimestamps.length >= 2) {
      sessionMinutes = (todayTimestamps[todayTimestamps.length - 1] - todayTimestamps[0]) / 60000;
    }

    // --- Account age (days since first ever posting) ---
    let accountAgeDays = 0;
    if (postings.length > 0) {
      const firstEver = new Date(postings[0].timestamp).getTime();
      accountAgeDays = Math.floor((now - firstEver) / (24 * 60 * 60 * 1000));
    }

    // --- Success rate today ---
    const successToday = todayStats.successCount || 0;
    const failedToday = todayStats.failedCount || 0;
    const successRate = postsToday > 0 ? Math.round((successToday / postsToday) * 100) : 100;

    // --- Automation runs today ---
    const automationRuns = todayStats.automationRuns || 0;

    res.json({
      success: true,
      data: {
        postsToday,
        postsThisHour,
        postsThisWeek: thisWeekCount,
        postsLastWeek: lastWeekCount,
        avgDelayMinutes: avgDelay >= 0 ? Math.round(avgDelay * 10) / 10 : -1,
        minDelayMinutes: minDelay >= 0 ? Math.round(minDelay * 10) / 10 : -1,
        intervalCV: intervalCV >= 0 ? Math.round(intervalCV * 100) / 100 : -1,
        diversityRatio: Math.round(diversityRatio * 100) / 100,
        uniqueProperties,
        sessionMinutes: Math.round(sessionMinutes),
        accountAgeDays,
        successRate,
        automationRuns,
        successToday,
        failedToday,
        timestamps: todayTimestamps,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset all posting analytics data
app.post('/api/analytics/reset', ...auth, (req, res) => {
  try {
    req.postingTracker.resetAll();
    console.log('✅ Analytics data reset via API');
    res.json({ success: true, message: 'All analytics data reset' });
  } catch (error) {
    console.error('❌ Reset failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Grand$tate API running on http://localhost:${PORT}`);
  console.log(`� CORS: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`🌐 Multi-user: max ${10} concurrent browsers`);
  console.log(`📋 Auth: Supabase JWT required on all /api/* routes`);
  console.log(`💡 Health: GET /api/ping (no auth)`);
});
