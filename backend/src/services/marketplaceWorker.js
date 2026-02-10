import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { PostingTracker } from './postingTracker.js';

// Anthropic SDK is optional
let Anthropic = null;
try {
  const anthropicModule = await import('@anthropic-ai/sdk');
  Anthropic = anthropicModule.default;
} catch (e) {
  console.log('⚠️ Anthropic SDK not installed - Claude API features disabled');
}

puppeteer.use(StealthPlugin());

// Browser executable paths for Windows
const BROWSER_PATHS = {
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ],
  edge: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

function findBrowserPath(browser) {
  const paths = BROWSER_PATHS[browser] || BROWSER_PATHS.chrome;
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export class MarketplaceWorker {
  constructor(userId = 'default') {
    this.userId = userId;
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.isPaused = false;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.currentTask = null;
    this.tasks = [];
    this.batches = [];
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.anthropic = null;
    this.tracker = new PostingTracker(userId);

    // Auto-init from env var if available
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey && Anthropic) {
      this.anthropic = new Anthropic({ apiKey: envKey });
    }
  }

  initAnthropicClient(apiKey) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key && Anthropic) {
      this.anthropic = new Anthropic({ apiKey: key });
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Human-like random delay
  async humanDelay(minMs = 800, maxMs = 2500) {
    const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs);
    return this.delay(ms);
  }

  // Normalize group name for fuzzy matching
  normalizeGroupName(name) {
    return (name || '')
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, '') // Keep Thai, English, numbers, spaces
      .trim()
      .toLowerCase();
  }

  // Check if two group names match (fuzzy)
  isGroupNameMatch(dbName, fbName) {
    const normDb = this.normalizeGroupName(dbName);
    const normFb = this.normalizeGroupName(fbName);
    
    if (!normDb || !normFb) return false;
    
    // Exact match
    if (normDb === normFb) return true;
    
    // Contains match (either direction)
    if (normFb.includes(normDb) || normDb.includes(normFb)) return true;
    
    // Word overlap match — STRICT: use MAX of both word counts (not min)
    // Common words like "ซื้อ","ขาย" alone should NOT cause a match
    const COMMON = ['ซื้อ', 'ขาย', 'เช่า', 'บ้าน', 'ที่ดิน', 'คอนโด', 'อสังหา', 'กลุ่ม', 'ประเทศ', 'มือสอง'];
    const dbWords = normDb.split(' ').filter(w => w.length > 1);
    const fbWords = normFb.split(' ').filter(w => w.length > 1);
    if (dbWords.length === 0 || fbWords.length === 0) return false;
    
    // Count matching words (excluding ultra-common ones for ratio calc)
    const allMatches = dbWords.filter(w => fbWords.some(fw => fw.includes(w) || w.includes(fw)));
    const significantMatches = allMatches.filter(w => !COMMON.some(c => c === w));
    
    // Must have at least 1 significant (non-common) word match
    // AND total match ratio >= 50% of the LARGER word set
    const matchRatio = allMatches.length / Math.max(dbWords.length, fbWords.length);
    
    return significantMatches.length >= 1 && matchRatio >= 0.5;
  }

  // ============================================
  // BROWSER MANAGEMENT
  // ============================================

  // Borrow browser from groupWorker (preferred - avoids profile lock)
  borrowBrowser(browser, page) {
    this.browser = browser;
    this.page = page;
    this.borrowedBrowser = true;
    console.log('🔗 Marketplace: Borrowed browser from groupWorker');
  }

  async initialize(browserType = 'chrome') {
    // If already have a working browser, skip
    if (this.browser && this.browser.isConnected()) {
      console.log('✅ Browser already connected, reusing...');
      return;
    }

    // Clean up dead browser ref
    this.browser = null;
    this.page = null;
    this.borrowedBrowser = false;

    const isVPS = process.platform === 'linux';
    const isHeadless = process.env.HEADLESS === 'true' || isVPS;

    // Per-user marketplace profile directory
    const appProfileDir = path.join(process.cwd(), 'profiles', this.userId, 'marketplace-profile');
    if (!fs.existsSync(appProfileDir)) {
      fs.mkdirSync(appProfileDir, { recursive: true });
    }

    const launchOptions = {
      headless: isHeadless ? 'new' : false,
      defaultViewport: isHeadless ? { width: 1920, height: 1080 } : null,
      userDataDir: appProfileDir,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };

    // On Windows: use local browser; On VPS: use puppeteer's bundled Chromium
    if (!isVPS) {
      const executablePath = findBrowserPath(browserType);
      if (!executablePath) {
        throw new Error(`ไม่พบ ${browserType} ในเครื่อง กรุณาติดตั้งก่อน`);
      }
      launchOptions.executablePath = executablePath;
    }

    const shortId = this.userId.substring(0, 8);
    console.log(`🚀 [${shortId}] Launching ${isVPS ? 'Chromium (VPS)' : browserType} for Marketplace...`);
    console.log(`📁 Profile: ${appProfileDir}`);
    console.log(`👁️ Headless: ${isHeadless}`);

    this.browser = await puppeteer.launch(launchOptions);

    this.borrowedBrowser = false;

    this.browser.on('disconnected', () => {
      console.log('🔴 Browser closed by user');
      this.handleBrowserClosed();
    });

    await this.delay(1000);

    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8'
    });

    // Hide navigator.webdriver flag to avoid detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log(`✅ ${browserType} เปิดแล้ว (Marketplace mode)`);
  }

  handleBrowserClosed() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.isPaused = false;
    this.tasks = [];
    this.batches = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.currentTask = null;
  }

  isBrowserConnected() {
    return this.browser && this.browser.isConnected();
  }

  async checkLogin() {
    try {
      if (!this.browser || !this.browser.isConnected()) return false;

      await this.page.goto('https://www.facebook.com', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await this.delay(2000);

      return await this.page.evaluate(() => {
        return !document.querySelector('input[name="email"]') &&
               !document.querySelector('button[name="login"]');
      });
    } catch (error) {
      console.error('Login check error:', error.message);
      return false;
    }
  }

  // ============================================
  // CHECKPOINT / CAPTCHA DETECTION
  // ============================================

  async detectCheckpoint() {
    try {
      const result = await this.page.evaluate(() => {
        const url = window.location.href;
        const bodyText = document.body?.innerText || '';

        // Check URL patterns
        if (url.includes('/checkpoint') || url.includes('/login/identify') || url.includes('/recover')) {
          return { detected: true, type: 'checkpoint', reason: 'checkpoint URL detected' };
        }

        // Check for captcha
        if (bodyText.includes('ยืนยันตัวตน') || bodyText.includes('Verify your identity') ||
            bodyText.includes('กรุณายืนยัน') || bodyText.includes('security check') ||
            bodyText.includes('Enter the code') || bodyText.includes('ใส่รหัส')) {
          return { detected: true, type: 'captcha', reason: 'captcha/verification prompt' };
        }

        // Check for temporary block
        if (bodyText.includes('ถูกจำกัด') || bodyText.includes('restricted') ||
            bodyText.includes('ถูกบล็อก') || bodyText.includes('temporarily blocked') ||
            bodyText.includes('ลองอีกครั้งในภายหลัง') || bodyText.includes('try again later')) {
          return { detected: true, type: 'blocked', reason: 'account temporarily blocked' };
        }

        // Check for session expired
        if (bodyText.includes('เซสชันหมดอายุ') || bodyText.includes('session expired') ||
            document.querySelector('input[name="email"]')) {
          return { detected: true, type: 'session_expired', reason: 'session expired / logged out' };
        }

        return { detected: false };
      });

      if (result.detected) {
        console.log(`🚨 DETECTED: ${result.type} — ${result.reason}`);
      }
      return result;
    } catch {
      return { detected: false };
    }
  }

  // ============================================
  // MARKETPLACE FORM FILLING
  // ============================================

  mapPropertyType(type) {
    // Map to Facebook Marketplace Thai labels (from actual dropdown options)
    const typeMap = {
      'condo': 'อพาร์ทเมนท์',
      'house': 'บ้าน',
      'townhouse': 'ทาวน์เฮาส์',
      'apartment': 'อพาร์ทเมนท์',
      'land': 'บ้าน',
      'commercial': 'อพาร์ทเมนท์',
    };
    return typeMap[type] || 'บ้าน';
  }

  mapListingType(listingType) {
    return listingType === 'rent' ? 'ให้เช่า' : 'สำหรับขาย';
  }

  async navigateToMarketplaceCreate() {
    console.log('🔄 Opening Marketplace create listing...');

    await this.page.goto('https://www.facebook.com/marketplace/create', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Human-like: page loaded, scan the categories (2-4s)
    await this.humanDelay(2000, 4000);

    // Step 1: Click "บ้านสำหรับขายหรือเช่า" category card
    // MUST use Puppeteer native click (not JS click) because Facebook React ignores synthetic events
    console.log('📌 Selecting property category: บ้านสำหรับขายหรือเช่า...');

    const keywords = ['บ้านสำหรับขายหรือเช่า', 'บ้านสำหรับขาย', 'Home for Sale', 'Homes for Sale or Rent'];
    let clicked = false;

    // Method 1: Find the card element's bounding box and click with real mouse
    const cardBox = await this.page.evaluate((keywords) => {
      const allSpans = document.querySelectorAll('span');
      for (const span of allSpans) {
        const text = (span.textContent || '').trim();
        if (!keywords.some(kw => text === kw)) continue;

        // Walk up to find the card container (div with icon inside)
        let card = span;
        for (let i = 0; i < 15; i++) {
          if (!card.parentElement) break;
          card = card.parentElement;
          const hasIcon = card.querySelector('i[data-visualcompletion="css-img"]');
          if (hasIcon) {
            const rect = card.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }

        // Fallback: use the span's own position
        const rect = span.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
      }
      return { found: false };
    }, keywords);

    if (cardBox.found) {
      // Human-like: move mouse to card area first, then click (not instant teleport)
      console.log(`📍 Clicking at (${Math.round(cardBox.x)}, ${Math.round(cardBox.y)})...`);
      await this.page.mouse.move(cardBox.x, cardBox.y, { steps: 5 + Math.floor(Math.random() * 5) });
      await this.humanDelay(200, 500);
      await this.page.mouse.click(cardBox.x, cardBox.y);
      clicked = true;
      await this.humanDelay(2000, 3000);
    }

    // Method 2: If method 1 didn't navigate, try direct URL
    const currentUrl = this.page.url();
    if (!clicked || currentUrl.includes('/marketplace/create') && !currentUrl.includes('/create/rental') && !currentUrl.includes('/create/item')) {
      console.log('⚠️ Card click may not have worked, trying direct URL...');
      await this.page.goto('https://www.facebook.com/marketplace/create/rental', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      clicked = true;
    }

    await this.delay(3000);

    // Verify we're on the form page
    const finalUrl = this.page.url();
    if (finalUrl.includes('/create/rental') || finalUrl.includes('/create/item')) {
      console.log(`✅ Property form loaded: ${finalUrl}`);
    } else {
      console.log(`⚠️ Current URL: ${finalUrl} — may need manual check`);
    }
  }

  // Shuffle array (Fisher-Yates) for random image selection
  shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Select random images from property (min 1, max all)
  selectRandomImages(images, minCount = 1, maxCount = 20) {
    if (!images || images.length === 0) return [];
    const count = Math.min(
      images.length,
      Math.max(minCount, Math.floor(Math.random() * Math.min(images.length, maxCount)) + 1)
    );
    return this.shuffleArray(images).slice(0, count);
  }

  async uploadImages(images) {
    if (!images || images.length === 0) return true;

    console.log(`📷 Uploading ${images.length} images...`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePaths = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (image.startsWith('data:')) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const filePath = path.join(tempDir, `mkt_img_${Date.now()}_${i}.jpg`);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        filePaths.push(filePath);
      } else if (image.startsWith('http')) {
        // Download URL image to temp
        try {
          const response = await fetch(image);
          const buffer = Buffer.from(await response.arrayBuffer());
          const filePath = path.join(tempDir, `mkt_img_${Date.now()}_${i}.jpg`);
          fs.writeFileSync(filePath, buffer);
          filePaths.push(filePath);
        } catch (e) {
          console.warn(`⚠️ Failed to download image ${i}:`, e.message);
        }
      } else if (fs.existsSync(image)) {
        filePaths.push(image);
      }
    }

    if (filePaths.length === 0) return false;

    try {
      // Find file input - Facebook may hide it
      const fileInputSelector = 'input[type="file"]';
      await this.page.waitForSelector(fileInputSelector, { timeout: 10000 });

      const fileInputs = await this.page.$$(fileInputSelector);
      // Use the first file input that accepts images
      let uploaded = false;
      for (const fileInput of fileInputs) {
        try {
          await fileInput.uploadFile(...filePaths);
          uploaded = true;
          console.log(`✅ ${filePaths.length} images uploaded`);
          break;
        } catch (e) { continue; }
      }

      if (!uploaded) {
        // Fallback: click "เพิ่มรูปภาพ" area then upload
        const addPhotoBox = await this.page.evaluate(() => {
          const spans = document.querySelectorAll('span');
          for (const s of spans) {
            if (s.textContent?.includes('เพิ่มรูปภาพ') || s.textContent?.includes('Add Photos')) {
              const rect = s.getBoundingClientRect();
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
            }
          }
          return { found: false };
        });

        if (addPhotoBox.found) {
          await this.page.mouse.click(addPhotoBox.x, addPhotoBox.y);
          await this.delay(1000);
          const fi = await this.page.$(fileInputSelector);
          if (fi) {
            await fi.uploadFile(...filePaths);
            console.log(`✅ ${filePaths.length} images uploaded (fallback)`);
          }
        }
      }

      // Wait for images to process
      await this.delay(2000 + filePaths.length * 500);

      // Cleanup temp files after 60s
      setTimeout(() => {
        for (const fp of filePaths) {
          if (fp.includes('temp')) {
            try { fs.unlinkSync(fp); } catch (e) {}
          }
        }
      }, 60000);

      return true;
    } catch (error) {
      console.error('⚠️ Image upload error:', error.message);
      return false;
    }
  }

  // ============================================
  // FORM INTERACTION HELPERS (Puppeteer Native)
  // All use real mouse/keyboard events for React compatibility
  // ============================================

  // Scroll element into viewport before interacting
  async scrollToLabel(labelText) {
    await this.page.evaluate((label) => {
      const spans = document.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text === label || text.includes(label)) {
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }, labelText);
    await this.delay(500);
  }

  // Find element position by label text, then click + type into related input
  async nativeTypeInInput(labelText, value) {
    if (!value && value !== 0) return;
    const val = String(value);

    console.log(`  ⌨️ Typing "${val}" into "${labelText}"...`);

    // Scroll to the label first so it's visible
    await this.scrollToLabel(labelText);

    // Find the input's bounding box
    const inputBox = await this.page.evaluate((label) => {
      const spans = document.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text !== label && !text.includes(label)) continue;

        // Strategy 1: Find input inside closest label
        const labelEl = span.closest('label');
        if (labelEl) {
          const input = labelEl.querySelector('input');
          if (input) {
            input.scrollIntoView({ block: 'center' });
            const rect = input.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }

        // Strategy 2: Walk up and find nearby input
        let parent = span.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!parent) break;
          const input = parent.querySelector('input[type="text"], input:not([type])');
          if (input) {
            input.scrollIntoView({ block: 'center' });
            const rect = input.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
          parent = parent.parentElement;
        }
      }
      return { found: false };
    }, labelText);

    if (!inputBox.found) {
      console.log(`    ⚠️ Input "${labelText}" not found`);
      return;
    }

    // Click the input with real mouse
    await this.page.mouse.click(inputBox.x, inputBox.y);
    await this.delay(300);

    // Select all existing text and delete
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Backspace');
    await this.delay(200);

    // Type value character by character — speed varies by content type
    const isNumeric = /^[\d,.]+$/.test(val);
    const baseDelay = isNumeric ? 40 : 25; // numbers: slower deliberate typing
    const jitter = isNumeric ? 30 : 20;
    await this.page.keyboard.type(val, { delay: baseDelay + Math.random() * jitter });
    console.log(`    ✅ Done (${isNumeric ? 'numeric' : 'text'} mode)`);
  }

  // Click dropdown to open, then click the matching option
  async nativeSelectDropdown(labelText, optionValue) {
    if (!optionValue) return;

    console.log(`  🔽 Selecting "${optionValue}" in dropdown "${labelText}"...`);

    // Scroll to label first
    await this.scrollToLabel(labelText);

    // Find the dropdown element position
    const dropdownBox = await this.page.evaluate((label) => {
      const spans = document.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text !== label && !text.includes(label)) continue;

        // PRIORITY 1: Find [role="combobox"] ancestor (most reliable)
        const combobox = span.closest('[role="combobox"]');
        if (combobox) {
          const rect = combobox.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'combobox' };
          }
        }

        // PRIORITY 2: Walk up to find dropdown-sized element with SVG arrow
        // MUST check element SIZE — Facebook puts SVGs everywhere, so a parent container
        // with any SVG would match. Real dropdown trigger is small (height < 80px).
        let el = span;
        for (let i = 0; i < 10; i++) {
          if (!el.parentElement) break;
          el = el.parentElement;
          const rect = el.getBoundingClientRect();
          // Skip elements that are too large (containers) or too small
          if (rect.height > 80 || rect.height < 20 || rect.width < 50) continue;
          if (el.getAttribute('role') === 'combobox' || el.querySelector(':scope > svg') || el.querySelector('[data-visualcompletion]')) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'walkup-sized' };
          }
        }

        // PRIORITY 3: Find nearby combobox sibling
        let parent = span;
        for (let i = 0; i < 5; i++) {
          if (!parent.parentElement) break;
          parent = parent.parentElement;
          const combo = parent.querySelector('[role="combobox"]');
          if (combo && combo !== span) {
            const rect = combo.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'sibling-combo' };
            }
          }
        }

        // Fallback: click the span's parent div with tabindex
        const tabParent = span.closest('div[tabindex]') || span.parentElement?.parentElement;
        if (tabParent) {
          const rect = tabParent.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'fallback' };
        }
      }
      return { found: false };
    }, labelText);

    if (dropdownBox.found) {
      console.log(`    📍 Found dropdown via ${dropdownBox.method} at (${Math.round(dropdownBox.x)}, ${Math.round(dropdownBox.y)})`);
    }

    if (!dropdownBox.found) {
      console.log(`    ⚠️ Dropdown "${labelText}" not found`);
      return;
    }

    // Click dropdown to open it
    await this.page.mouse.click(dropdownBox.x, dropdownBox.y);
    await this.delay(800);

    // Now find and click the option inside the opened dropdown
    const optionBox = await this.page.evaluate((val) => {
      // Search through all visible option-like elements
      const selectors = '[role="option"], [role="menuitem"], [role="listbox"] [role="option"]';
      let options = document.querySelectorAll(selectors);

      // Also search plain divs/spans in dropdown overlays
      if (options.length === 0) {
        options = document.querySelectorAll('[role="listbox"] div, [role="menu"] div, [data-visualcompletion="ignore-dynamic"] div');
      }

      for (const option of options) {
        const text = (option.textContent || '').trim();
        if (text === val || text.includes(val)) {
          const rect = option.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }
      }

      // Broader search: any visible element with exact text
      const allEls = document.querySelectorAll('span, div');
      for (const el of allEls) {
        // Only match leaf elements with exact text
        if (el.children.length > 0) continue;
        const text = (el.textContent || '').trim();
        if (text === val) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.y > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }
      }

      return { found: false };
    }, optionValue);

    if (optionBox.found) {
      await this.page.mouse.click(optionBox.x, optionBox.y);
      console.log(`    ✅ Selected "${optionValue}"`);
    } else {
      console.log(`    ⚠️ Option "${optionValue}" not found in dropdown`);
      // Close dropdown by pressing Escape
      await this.page.keyboard.press('Escape');
    }

    await this.delay(500);
  }

  // Type into textarea (description field)
  async nativeTypeInTextarea(labelText, value) {
    if (!value) return;

    console.log(`  📝 Typing description (looking for: "${labelText}")...`);

    // Scroll down to make textarea visible
    await this.page.evaluate(() => window.scrollBy(0, 300));
    await this.delay(500);

    // Try multiple label variations for Facebook's changing UI
    const labelVariants = [
      labelText,
      'คำอธิบาย',
      'คำอธิบายของที่พักให้เช่า',
      'คำอธิบายอสังหาริมทรัพย์',
      'Description',
      'description',
    ];

    const textareaBox = await this.page.evaluate((labels) => {
      // Strategy 1: Find textarea via label text matching
      for (const label of labels) {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          const text = (span.textContent || '').trim();
          if (!text.includes(label)) continue;

          // Check inside label element
          const labelEl = span.closest('label');
          if (labelEl) {
            const ta = labelEl.querySelector('textarea');
            if (ta) {
              ta.scrollIntoView({ block: 'center' });
              const rect = ta.getBoundingClientRect();
              if (rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'label-match' };
            }
          }

          // Walk up DOM to find textarea nearby
          let parent = span.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!parent) break;
            const ta = parent.querySelector('textarea');
            if (ta) {
              ta.scrollIntoView({ block: 'center' });
              const rect = ta.getBoundingClientRect();
              if (rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'walk-up' };
            }
            parent = parent.parentElement;
          }
        }
      }

      // Strategy 2: Find textarea by aria-describedby (FB uses this pattern)
      const allTextareas = document.querySelectorAll('textarea');
      for (const ta of allTextareas) {
        const rect = ta.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 30 && rect.y > 0 && rect.y < window.innerHeight + 500) {
          ta.scrollIntoView({ block: 'center' });
          const r = ta.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'any-textarea' };
        }
      }

      // Strategy 3: Find by placeholder text
      for (const ta of allTextareas) {
        const ph = ta.getAttribute('placeholder') || '';
        if (ph.includes('คำอธิบาย') || ph.includes('description') || ph.includes('อธิบาย')) {
          ta.scrollIntoView({ block: 'center' });
          const rect = ta.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'placeholder' };
        }
      }

      // Strategy 4: Absolute fallback — first visible textarea
      if (allTextareas.length > 0) {
        const ta = allTextareas[0];
        ta.scrollIntoView({ block: 'center' });
        const rect = ta.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'first-textarea' };
      }

      return { found: false };
    }, labelVariants);

    if (!textareaBox.found) {
      console.log(`    ⚠️ Textarea not found with any strategy`);
      return;
    }

    console.log(`    🎯 Found textarea via: ${textareaBox.method}`);

    // Click directly on the textarea
    await this.page.mouse.click(textareaBox.x, textareaBox.y);
    await this.delay(500);

    // Verify we're actually in a textarea, not an input
    const isTextarea = await this.page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName?.toLowerCase() === 'textarea';
    });

    if (!isTextarea) {
      console.log(`    ⚠️ Active element is not textarea, trying direct focus...`);
      // Force focus on the textarea element
      await this.page.evaluate((box) => {
        const textareas = document.querySelectorAll('textarea');
        for (const ta of textareas) {
          const rect = ta.getBoundingClientRect();
          if (Math.abs(rect.x + rect.width / 2 - box.x) < 50 && Math.abs(rect.y + rect.height / 2 - box.y) < 50) {
            ta.focus();
            ta.click();
            return;
          }
        }
        // Last resort: focus first textarea
        if (textareas.length > 0) {
          textareas[0].focus();
          textareas[0].click();
        }
      }, textareaBox);
      await this.delay(300);
    }

    // Clear existing text
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyA');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Backspace');
    await this.delay(200);

    // Type the description — mixed speed like a real person
    // Type in chunks: fast bursts with occasional micro-pauses (thinking while typing)
    const chars = value.split('');
    let charIdx = 0;
    while (charIdx < chars.length) {
      // Burst: type 10-30 chars at normal speed
      const burstLen = Math.min(10 + Math.floor(Math.random() * 20), chars.length - charIdx);
      const burst = chars.slice(charIdx, charIdx + burstLen).join('');
      await this.page.keyboard.type(burst, { delay: 18 + Math.random() * 15 });
      charIdx += burstLen;
      // Micro-pause between bursts (like pausing to think mid-sentence)
      if (charIdx < chars.length && Math.random() < 0.3) {
        await this.delay(200 + Math.floor(Math.random() * 500));
      }
    }
    console.log(`    ✅ Description typed (${value.length} chars, burst mode)`);
  }

  // Fill location with autocomplete — CRITICAL: must select from dropdown
  async nativeFillLocation(location) {
    if (!location) return;

    console.log(`  📍 Filling location: "${location}"...`);

    // Scroll down to find location input
    await this.page.evaluate(() => window.scrollBy(0, 300));
    await this.delay(800);

    // Find the location input — MUST skip the search bar at top
    const locationBox = await this.page.evaluate(() => {
      // Strategy 1: Find label that contains a map pin SVG + combobox input
      // This is the most reliable way to find the FORM location field (not the search bar)
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        const svg = label.querySelector('svg');
        const input = label.querySelector('input[role="combobox"], input[type="text"], input:not([type])');
        if (!svg || !input) continue;

        // Check if SVG contains a map pin path (the location icon)
        const paths = svg.querySelectorAll('path');
        let isMapPin = false;
        for (const p of paths) {
          const d = p.getAttribute('d') || '';
          // Map pin SVGs typically contain these curve patterns
          if (d.includes('M10') && (d.includes('7.5') || d.includes('8')) && d.includes('1 0 0')) {
            isMapPin = true;
            break;
          }
        }

        if (isMapPin) {
          input.scrollIntoView({ block: 'center' });
          const rect = input.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'map-pin-label' };
          }
        }
      }

      // Strategy 2: Find combobox that is INSIDE the form area (not at the top)
      // The form area is usually below y=200 and the search bar is at the very top
      const combos = document.querySelectorAll('input[role="combobox"]');
      for (const input of combos) {
        const rect = input.getBoundingClientRect();
        // Skip if it's at the very top (search bar) — form fields are lower
        if (rect.y < 150) continue;
        // Skip if already has value (other fields)
        if (input.value && input.value.length > 0) continue;
        if (rect.width > 50 && rect.height > 0) {
          input.scrollIntoView({ block: 'center' });
          const r = input.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'combobox-in-form' };
        }
      }

      // Strategy 3: Find label with SVG icon + input (any SVG, relaxed match)
      for (const label of labels) {
        const svg = label.querySelector('svg');
        const input = label.querySelector('input');
        if (!svg || !input) continue;
        const rect = input.getBoundingClientRect();
        // Must be in form area, not top search
        if (rect.y < 150) continue;
        if (rect.width > 50 && rect.height > 0 && !input.value) {
          input.scrollIntoView({ block: 'center' });
          const r = input.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'svg-label-input' };
        }
      }

      return { found: false };
    });

    if (!locationBox.found) {
      console.log(`    ⚠️ Location input not found`);
      return;
    }

    console.log(`    🎯 Found location input via: ${locationBox.method}`);

    // Try multiple search terms: province first (most reliable), then district+province
    const searchTerms = [];
    const parts = location.split(' ').filter(Boolean);
    
    // If we have "district province", try province alone first (most reliable for FB)
    if (parts.length >= 2) {
      searchTerms.push(parts[parts.length - 1]); // province only
      searchTerms.push(location); // full text
    } else {
      searchTerms.push(location);
    }

    for (const searchTerm of searchTerms) {
      console.log(`    🔍 Trying: "${searchTerm}"...`);

      // Click the input
      await this.page.mouse.click(locationBox.x, locationBox.y);
      await this.delay(300);

      // Clear existing text
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      await this.delay(300);

      // Type search term slowly for autocomplete
      await this.page.keyboard.type(searchTerm, { delay: 80 + Math.random() * 40 });

      // Wait for Facebook autocomplete suggestions to load
      await this.delay(3000);

      // Try to find and click suggestion
      const suggestionClicked = await this.page.evaluate((search) => {
        // Strategy 1: [role="option"] items
        const options = document.querySelectorAll('[role="option"]');
        if (options.length > 0) {
          // Find best match
          for (const opt of options) {
            const text = (opt.textContent || '').trim();
            if (text.includes(search)) {
              opt.scrollIntoView({ block: 'center' });
              const rect = opt.getBoundingClientRect();
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text };
            }
          }
          // No exact match, click first option
          const first = options[0];
          first.scrollIntoView({ block: 'center' });
          const rect = first.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: (first.textContent || '').trim() };
        }

        // Strategy 2: [role="listbox"] children
        const listbox = document.querySelector('[role="listbox"]');
        if (listbox) {
          const items = listbox.querySelectorAll('li, div[role="option"], > div');
          for (const item of items) {
            const rect = item.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 20) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: (item.textContent || '').trim() };
            }
          }
        }

        // Strategy 3: Any popup/dropdown that appeared after typing
        const popups = document.querySelectorAll('[role="dialog"] li, [role="menu"] li, ul li');
        for (const popup of popups) {
          const text = (popup.textContent || '').trim();
          const rect = popup.getBoundingClientRect();
          if (text.includes(search) && rect.width > 50 && rect.height > 20 && rect.y > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text };
          }
        }

        return { found: false };
      }, searchTerm);

      if (suggestionClicked.found) {
        await this.page.mouse.click(suggestionClicked.x, suggestionClicked.y);
        console.log(`    ✅ Location selected: "${suggestionClicked.text?.substring(0, 50)}"`);
        await this.delay(1000);
        // CRITICAL: blur location input so next keyboard input doesn't go here
        await this.page.evaluate(() => {
          if (document.activeElement) document.activeElement.blur();
        });
        await this.delay(300);
        return;
      }
    }

    // Last resort: press ArrowDown + Enter to select first suggestion
    console.log(`    ⚠️ No clickable suggestion found, trying keyboard selection...`);
    await this.page.keyboard.press('ArrowDown');
    await this.delay(500);
    await this.page.keyboard.press('Enter');
    await this.delay(500);

    // CRITICAL: blur/defocus the location input so next typing goes to the right field
    await this.page.keyboard.press('Tab');
    await this.delay(300);
    await this.page.evaluate(() => {
      if (document.activeElement) document.activeElement.blur();
    });
    await this.delay(200);
  }

  // ============================================
  // MAIN FORM FILL FUNCTION
  // ============================================

  async fillPropertyForm(property, images) {
    console.log('📝 Filling Marketplace property form...');
    console.log(`   Property: ${property.title || 'N/A'}`);
    console.log(`   Type: ${property.listingType} / ${property.type}`);

    // Human-like: look at the form first before filling (1.5-3s)
    await this.humanDelay(1500, 3000);

    // Prepare form data from property
    const listingTypeLabel = this.mapListingType(property.listingType);
    const propertyTypeLabel = this.mapPropertyType(property.type || property.propertyType);
    const bedrooms = property.bedrooms?.toString() || '1';
    const bathrooms = property.bathrooms?.toString() || '1';
    const price = property.price?.toString() || '';
    // Build location for Facebook autocomplete: use district + province (most reliable)
    // Facebook needs a place name like "เชียงใหม่" not street address
    const locationParts = [
      property.district,
      property.province,
    ].filter(Boolean);
    const location = locationParts.length > 0 
      ? locationParts.join(' ') 
      : (property.location || '').split('|')[0].trim();
    const description = property.description || '';
    const size = property.size?.toString() || '';

    // 1. Upload ALL images from property, shuffled order
    const allImages = images && images.length > 0 ? images : (property.images || []);
    if (allImages.length > 0) {
      // Shuffle order so images aren't always the same sequence
      const shuffledImages = this.shuffleArray(allImages);
      console.log(`📷 Uploading ALL ${shuffledImages.length} images (shuffled order)`);
      await this.uploadImages(shuffledImages);
      await this.delay(2000 + shuffledImages.length * 500);
    }

    // 2. Select listing type: ให้เช่า / สำหรับขาย (with verify + retry)
    // Human-like: pause before first dropdown (reading the form)
    await this.humanDelay(800, 1500);
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.nativeSelectDropdown('บ้านสำหรับขายหรือเช่า', listingTypeLabel);
      await this.humanDelay(600, 1000);

      // Verify the dropdown was actually selected
      const listingTypeOk = await this.page.evaluate((expected) => {
        const spans = document.querySelectorAll('span');
        for (const s of spans) {
          const t = (s.textContent || '').trim();
          if (t === expected) return true;
        }
        return false;
      }, listingTypeLabel);

      if (listingTypeOk) {
        console.log(`    ✅ Listing type verified: "${listingTypeLabel}"`);
        break;
      }
      console.log(`    ⚠️ Listing type NOT verified (attempt ${attempt + 1}/3) — retrying...`);
      await this.delay(1000);
    }

    // 3. Select property type: อพาร์ทเมนท์ / บ้าน / ทาวน์เฮาส์
    // Facebook label changes based on listing type selection:
    //   - rent: "ประเภทของที่พักให้เช่า"
    //   - sale: "ประเภทอสังหาริมทรัพย์"
    const propTypeLabels = property.listingType === 'rent'
      ? ['ประเภทของที่พักให้เช่า', 'ประเภท']
      : ['ประเภทอสังหาริมทรัพย์', 'ประเภทของที่พักสำหรับขาย', 'ประเภท'];

    let propTypeSelected = false;
    for (const label of propTypeLabels) {
      const exists = await this.page.evaluate((lbl) => {
        const spans = document.querySelectorAll('span');
        for (const s of spans) {
          if ((s.textContent || '').trim().includes(lbl)) return true;
        }
        return false;
      }, label);

      if (exists) {
        await this.nativeSelectDropdown(label, propertyTypeLabel);
        propTypeSelected = true;
        break;
      }
    }
    if (!propTypeSelected) {
      console.log('    ⚠️ Property type dropdown not found with any known label');
    }
    await this.humanDelay(800, 1500);

    // 4. Bedrooms — quick field, humans type fast for numbers
    await this.nativeTypeInInput('จำนวนห้องนอน', bedrooms);
    await this.humanDelay(600, 1200);

    // 5. Bathrooms
    await this.nativeTypeInInput('จำนวนห้องน้ำ', bathrooms);
    await this.humanDelay(600, 1200);

    // 6. Price — humans pause to think about price before typing
    const priceLabel = property.listingType === 'rent' ? 'ราคาต่อเดือน' : 'ราคา';
    await this.humanDelay(500, 1000); // thinking pause before price
    await this.nativeTypeInInput(priceLabel, price);
    await this.humanDelay(800, 1500);

    // 7. Location — humans scroll down, pause to read, then fill
    // Scroll a little to see location field (like scanning the form)
    await this.page.evaluate(() => window.scrollBy(0, 150));
    await this.humanDelay(400, 800);
    await this.nativeFillLocation(location);
    await this.humanDelay(1000, 2000);

    // 8. Description — longest pause: humans think about what to write
    const descLabel = property.listingType === 'rent'
      ? 'คำอธิบายของที่พักให้เช่า'
      : 'คำอธิบายอสังหาริมทรัพย์';
    const fullDescription = description || `${property.title || ''}\n${property.bedrooms || ''} ห้องนอน ${property.bathrooms || ''} ห้องน้ำ\n${location}`;
    await this.humanDelay(800, 1500); // thinking pause before description
    await this.nativeTypeInTextarea(descLabel, fullDescription);
    await this.humanDelay(1000, 2000);

    // 9. Square meters (advanced section - scroll like scanning the form)
    if (size && size !== '0') {
      await this.page.evaluate(() => window.scrollBy(0, 300));
      await this.humanDelay(500, 1000);
      await this.nativeTypeInInput('ตารางเมตร', size);
      await this.humanDelay(500, 1000);
    }

    // Human-like: scroll up briefly to review the form before proceeding
    await this.page.evaluate(() => window.scrollBy(0, -200));
    await this.humanDelay(1000, 2000);
    console.log('✅ Form filled successfully!');
  }

  // ============================================
  // CLICK NEXT → "ลงประกาศในที่อื่นๆ" PAGE
  // ============================================

  async clickNext() {
    console.log('🔄 Clicking Next...');

    // Human-like: brief pause before clicking (reviewing form one last time)
    await this.humanDelay(800, 1500);

    const selectors = ['[aria-label="ถัดไป"]', '[aria-label="Next"]'];
    let clicked = false;

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.click(selector);
        clicked = true;
        break;
      } catch (e) { continue; }
    }

    if (!clicked) {
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
        const btn = buttons.find(b =>
          b.textContent?.includes('ถัดไป') || b.textContent?.includes('Next')
        );
        if (btn) btn.click();
      });
    }

    await this.delay(3000);

    // Verify we actually moved to group selection page (look for "สมาชิก" spans)
    const onGroupPage = await this.page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      for (const s of spans) {
        if (s.textContent?.includes('สมาชิก') && s.textContent.length < 100) return true;
      }
      return false;
    });

    if (onGroupPage) {
      console.log('✅ Next clicked → Group selection page (verified: found "สมาชิก")');
    } else {
      // Maybe form validation failed — check for error indicators
      console.log('⚠️ Next clicked but group page NOT detected — possible form validation error');
      console.log('   Waiting 3s and checking again...');
      await this.delay(3000);

      const retry = await this.page.evaluate(() => {
        const spans = document.querySelectorAll('span');
        for (const s of spans) {
          if (s.textContent?.includes('สมาชิก') && s.textContent.length < 100) return true;
        }
        return false;
      });

      if (retry) {
        console.log('✅ Group selection page loaded (after retry)');
      } else {
        console.log('❌ STILL not on group selection page — form may have validation errors');
        // Try clicking Next again in case the first click didn't register
        for (const selector of selectors) {
          try {
            const btn = await this.page.$(selector);
            if (btn) {
              await btn.click();
              console.log('   🔄 Re-clicked Next button');
              await this.delay(3000);
              break;
            }
          } catch (e) { continue; }
        }
      }
    }
  }

  // ============================================
  // 🔥 SCROLL-SCAN-TICK ENGINE v5 (Production)
  // Handles Facebook's VIRTUAL LIST (only ~8 groups in DOM at a time)
  // Must scroll to render more groups, then tick them
  // ============================================

  /**
   * Scan group names currently visible in the DOM (names only — for scroll tracking)
   * Returns: string[]
   */
  async scanVisibleGroupNames() {
    return await this.page.evaluate(() => {
      const names = [];
      const seen = new Set();
      const SKIP = ['ลงประกาศ', 'สูงสุด', 'เผยแพร่', 'สมาชิก', 'สาธารณะ', 'ก่อนหน้านี้', 'ส่วนตัว',
                     'กลุ่มที่แนะนำ', 'เลือกทั้งหมด', 'Marketplace', 'ถัดไป', 'ย้อนกลับ'];

      const allSpans = document.querySelectorAll('span');
      for (const s of allSpans) {
        const t = s.textContent || '';
        if (!t.includes('สมาชิก') || t.length >= 100) continue;

        const memberRect = s.getBoundingClientRect();
        let row = s;
        for (let i = 0; i < 5; i++) {
          row = row.parentElement;
          if (!row) break;
          const nameEls = row.querySelectorAll('span');
          let foundAtThisLevel = false;
          for (const ne of nameEls) {
            if (ne === s) continue; // Skip the member span itself
            const txt = ne.textContent?.trim();
            if (!txt || txt.length < 3 || txt.length > 200) continue;
            if (SKIP.some(skip => txt.includes(skip))) continue;
            // Skip if text is just numbers/punctuation
            if (/^[\d,.\s]+$/.test(txt)) continue;
            // PROXIMITY CHECK: name must be vertically close to member span
            const nameRect = ne.getBoundingClientRect();
            if (nameRect.width > 0 && nameRect.height > 0 && Math.abs(nameRect.y - memberRect.y) < 120) {
              if (!seen.has(txt)) {
                seen.add(txt);
                names.push(txt);
              }
              foundAtThisLevel = true;
              break;
            }
          }
          if (foundAtThisLevel) break; // Found a name for this member span — stop walking up
        }
      }
      return names;
    });
  }

  /**
   * Tick a group by finding its DOM element and clicking it via ElementHandle.click()
   * Uses REAL mouse events (works with Facebook React) + auto scroll-into-view
   * NO coordinates — Puppeteer calculates them at click time from the actual element
   * Returns: { result: 'ticked'|'not_found', fbName?: string }
   */
  async tickGroupDirect(targetName) {
    const SKIP = ['ลงประกาศ', 'สูงสุด', 'เผยแพร่', 'สมาชิก', 'สาธารณะ', 'ก่อนหน้านี้', 'ส่วนตัว',
                   'กลุ่มที่แนะนำ', 'เลือกทั้งหมด', 'Marketplace', 'ถัดไป', 'ย้อนกลับ'];

    // Step 1: Find the clickable row for this group using EXACT name match
    // (targetName comes from scanVisibleGroupNames — it's the exact text from the DOM)
    const handle = await this.page.evaluateHandle((targetName, SKIP) => {
      const allSpans = document.querySelectorAll('span');
      for (const s of allSpans) {
        if (!s.textContent?.includes('สมาชิก') || s.textContent.length >= 100) continue;
        const memberRect = s.getBoundingClientRect();

        let row = s;
        for (let i = 0; i < 5; i++) {
          row = row.parentElement;
          if (!row) break;
          const nameEls = row.querySelectorAll('span');
          for (const ne of nameEls) {
            if (ne === s) continue;
            const txt = ne.textContent?.trim();
            if (!txt || txt.length < 3 || txt.length > 200) continue;
            if (SKIP.some(sk => txt.includes(sk))) continue;
            if (/^[\d,.\s]+$/.test(txt)) continue;
            const nameRect = ne.getBoundingClientRect();
            if (Math.abs(nameRect.y - memberRect.y) > 120) continue;
            // EXACT match only — targetName is already the exact visible name from scan
            if (txt === targetName) {
              // Walk up to find SINGLE ROW element (height < 130px = 1 row only)
              let rowEl = ne;
              for (let j = 0; j < 8; j++) {
                if (!rowEl.parentElement) break;
                rowEl = rowEl.parentElement;
                const rr = rowEl.getBoundingClientRect();
                if (rr.width > 250 && rr.height > 40 && rr.height < 130 && rr.y > -10) {
                  return rowEl;
                }
              }
              // Fallback: return 3 levels up from name span
              let fallback = ne;
              for (let j = 0; j < 3; j++) {
                if (fallback.parentElement) fallback = fallback.parentElement;
              }
              return fallback;
            }
          }
        }
      }
      return null;
    }, targetName, SKIP);

    const el = handle.asElement();
    if (!el) {
      return { result: 'not_found' };
    }

    // Step 2: Get element info + check if already checked
    const elInfo = await el.evaluate(e => {
      const rect = e.getBoundingClientRect();
      // Find group name
      let name = '';
      const spans = e.querySelectorAll('span');
      for (const sp of spans) {
        const t = sp.textContent?.trim();
        if (t && t.length >= 3 && t.length < 200 &&
            !t.includes('สมาชิก') && !t.includes('สาธารณะ') && !t.includes('ส่วนตัว') &&
            !/^[\d,.\s]+$/.test(t)) {
          name = t;
          break;
        }
      }
      // Check if already checked (aria-checked or blue checkbox SVG)
      let alreadyChecked = false;
      const cb = e.querySelector('[role="checkbox"]') || e.querySelector('input[type="checkbox"]');
      if (cb) {
        alreadyChecked = cb.getAttribute('aria-checked') === 'true' ||
                         cb.checked === true;
      }
      // Also check for blue SVG (Facebook uses this for checked state)
      if (!alreadyChecked) {
        const svgs = e.querySelectorAll('svg');
        for (const svg of svgs) {
          const paths = svg.querySelectorAll('path, circle');
          for (const p of paths) {
            const fill = (p.getAttribute('fill') || '').toLowerCase();
            if (fill.includes('0866ff') || fill.includes('0064e0')) {
              alreadyChecked = true;
              break;
            }
          }
          if (alreadyChecked) break;
        }
      }

      return {
        name: name || e.textContent?.trim().substring(0, 60) || '',
        tag: e.tagName,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        alreadyChecked,
        hasCheckbox: !!cb,
      };
    });

    const fbName = elInfo.name || '';

    // Step 3: If already checked, don't click (would UNTICK!)
    if (elInfo.alreadyChecked) {
      console.log(`     ✅ "${fbName}" already checked — skipping to prevent untick`);
      return { result: 'ticked', fbName };
    }

    // Step 4: Click the row to toggle checkbox
    const box = await el.boundingBox();
    if (!box) {
      console.log(`     ⚠️ Element has no bounding box`);
      return { result: 'not_found', fbName };
    }

    // Click the NAME AREA (left-center of row) — NOT right side
    // Facebook toggles checkbox when clicking ANYWHERE on the row
    // Clicking center-left avoids hitting other group's checkboxes
    const clickX = box.x + Math.min(box.width * 0.4, 200);
    const clickY = box.y + box.height / 2;
    console.log(`     🖱️ click(${Math.round(clickX)}, ${Math.round(clickY)}) on <${elInfo.tag}> ${elInfo.w}x${elInfo.h} "${fbName}"`);
    await this.page.mouse.click(clickX, clickY);

    await this.humanDelay(400, 700);

    // Post-click verification: read back checkbox state to detect accidental untick
    // IMPORTANT: Only re-click if we can CONFIRM it was unticked (not on read failure)
    const postClickState = await el.evaluate(e => {
      try {
        const cb = e.querySelector('[role="checkbox"]') || e.querySelector('input[type="checkbox"]');
        if (cb) {
          const checked = cb.getAttribute('aria-checked') === 'true' || cb.checked === true;
          return { readable: true, checked };
        }
        // Check blue SVG (Facebook checked indicator)
        const svgs = e.querySelectorAll('svg');
        for (const svg of svgs) {
          const paths = svg.querySelectorAll('path, circle');
          for (const p of paths) {
            const fill = (p.getAttribute('fill') || '').toLowerCase();
            if (fill.includes('0866ff') || fill.includes('0064e0')) {
              return { readable: true, checked: true };
            }
          }
        }
        return { readable: false }; // Can't determine state
      } catch {
        return { readable: false };
      }
    }).catch(() => ({ readable: false }));

    if (postClickState.readable && !postClickState.checked) {
      // We can confirm it's NOT checked — this means our click unticked it!
      // Click once more to re-tick
      console.log(`     ⚠️ Post-click verify: UNTICKED detected — re-clicking to fix`);
      await this.page.mouse.click(clickX, clickY);
      await this.humanDelay(300, 500);
      console.log(`     ✅ Re-ticked "${fbName}"`);
    } else {
      console.log(`     ✅ Ticked "${fbName}" ${postClickState.readable ? '(verified)' : '(trusted)'}`);
    }

    return { result: 'ticked', fbName };
  }

  /**
   * Find the scrollable container for the group list
   * Returns: { found, centerX, centerY, scrollTop, scrollHeight, clientHeight }
   */
  async findScrollContainer() {
    return await this.page.evaluate(() => {
      // Strategy 1: Find dialog, then find scrollable child
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const allDivs = dialog.querySelectorAll('div');
        let bestContainer = null;
        let bestScrollable = 0;
        for (const div of allDivs) {
          const style = getComputedStyle(div);
          const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
          if (!isScrollable) continue;
          const scrollable = div.scrollHeight - div.clientHeight;
          // Must contain "สมาชิก" text (group list marker)
          if (scrollable > 30 && div.textContent?.includes('สมาชิก') && scrollable > bestScrollable) {
            bestScrollable = scrollable;
            bestContainer = div;
          }
        }
        if (bestContainer) {
          const rect = bestContainer.getBoundingClientRect();
          return {
            found: true,
            strategy: 'dialog-scrollable',
            centerX: Math.round(rect.x + rect.width / 2),
            centerY: Math.round(rect.y + rect.height / 2),
            scrollTop: bestContainer.scrollTop,
            scrollHeight: bestContainer.scrollHeight,
            clientHeight: bestContainer.clientHeight,
          };
        }
      }

      // Strategy 2: Walk up from a "สมาชิก" span
      const spans = document.querySelectorAll('span');
      for (const s of spans) {
        if (!s.textContent?.includes('สมาชิก') || s.textContent.length >= 100) continue;
        let el = s;
        for (let i = 0; i < 20; i++) {
          el = el.parentElement;
          if (!el) break;
          const scrollable = el.scrollHeight - el.clientHeight;
          if (scrollable > 30) {
            const rect = el.getBoundingClientRect();
            return {
              found: true,
              strategy: 'walk-up',
              centerX: Math.round(rect.x + rect.width / 2),
              centerY: Math.round(rect.y + rect.height / 2),
              scrollTop: el.scrollTop,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            };
          }
        }
        break;
      }

      return { found: false };
    });
  }

  /**
   * Scroll the group list — tries 5 strategies until one works
   * IMPORTANT: Never click on group rows here (would toggle checkboxes!)
   */
  async scrollGroupList() {
    // ── Strategy 1: scrollIntoView on last visible group's "สมาชิก" span ──
    // This makes the browser scroll the correct container natively
    const sivResult = await this.page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')].filter(
        s => s.textContent?.includes('สมาชิก') && s.textContent.length < 100
      );
      if (spans.length === 0) return { done: false, reason: 'no-member-spans' };
      const last = spans[spans.length - 1];
      // Walk up to find the row
      let row = last;
      for (let i = 0; i < 8; i++) {
        row = row.parentElement;
        if (!row) break;
        if (row.offsetHeight > 30 && row.textContent?.includes('สมาชิก')) break;
      }
      if (row) {
        row.scrollIntoView({ behavior: 'instant', block: 'start' });
        return { done: true, strategy: 'scrollIntoView-last-row' };
      }
      return { done: false, reason: 'no-row-found' };
    });

    if (sivResult.done) {
      console.log(`     📜 ${sivResult.strategy}`);
      await this.delay(800);
      return true;
    }

    // ── Strategy 2: Find ANY scrollable ancestor and scrollTop += 350 ──
    const domScroll = await this.page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { scrolled: false, reason: 'no-dialog' };

      // Collect ALL elements that have scrollable content (scrollHeight > clientHeight)
      const candidates = [];
      const allEls = dialog.querySelectorAll('*');
      for (const el of allEls) {
        const diff = el.scrollHeight - el.clientHeight;
        if (diff > 20 && el.textContent?.includes('สมาชิก')) {
          candidates.push({ el, diff });
        }
      }
      // Sort by smallest diff first (most specific/innermost container)
      candidates.sort((a, b) => a.diff - b.diff);

      for (const { el } of candidates) {
        const before = el.scrollTop;
        el.scrollTop = before + 350;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
        const after = el.scrollTop;
        if (after > before) {
          return {
            scrolled: true,
            strategy: 'scrollTop+event',
            delta: Math.round(after - before),
            tag: el.tagName,
            scrollableCount: candidates.length,
          };
        }
      }

      return { scrolled: false, reason: 'no-scrollable-moved', candidateCount: candidates.length };
    });

    if (domScroll.scrolled) {
      console.log(`     📜 ${domScroll.strategy} (${domScroll.delta}px) [${domScroll.scrollableCount} candidates]`);
      await this.delay(800);
      return true;
    }
    console.log(`     📜 DOM scroll failed: ${domScroll.reason} (${domScroll.candidateCount || 0} candidates)`);

    // ── Strategy 3: Mouse wheel at the CENTER of the group list area (MORE AGGRESSIVE) ──
    const wheelPos = await this.page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')].filter(
        s => s.textContent?.includes('สมาชิก') && s.textContent.length < 100
      );
      if (spans.length >= 2) {
        const first = spans[0].getBoundingClientRect();
        const last = spans[spans.length - 1].getBoundingClientRect();
        return {
          x: Math.round((first.x + last.x) / 2 + first.width / 2),
          y: Math.round((first.y + last.y) / 2),
        };
      }
      if (spans.length === 1) {
        const r = spans[0].getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y) };
      }
      return { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
    });

    console.log(`     📜 mouse.wheel at (${wheelPos.x}, ${wheelPos.y})`);
    await this.page.mouse.move(wheelPos.x, wheelPos.y);
    await this.delay(100);
    // More aggressive wheel — 5 events × 200px = 1000px total scroll
    for (let i = 0; i < 5; i++) {
      await this.page.mouse.wheel({ deltaY: 200 });
      await this.delay(150);
    }
    await this.delay(600);

    // ── Strategy 4: Dispatch WheelEvent directly on the container from JS ──
    await this.page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;
      const spans = [...document.querySelectorAll('span')].filter(
        s => s.textContent?.includes('สมาชิก') && s.textContent.length < 100
      );
      if (spans.length === 0) return;
      let target = spans[Math.floor(spans.length / 2)];
      for (let i = 0; i < 10; i++) {
        if (!target.parentElement) break;
        target = target.parentElement;
        const diff = target.scrollHeight - target.clientHeight;
        if (diff > 20) break;
      }
      for (let i = 0; i < 4; i++) {
        target.dispatchEvent(new WheelEvent('wheel', {
          deltaY: 200, deltaMode: 0, bubbles: true, cancelable: true,
        }));
      }
    });
    console.log(`     📜 Also dispatched WheelEvent on container`);
    await this.delay(600);

    // ── Strategy 5: Keyboard-based scroll (Page Down) — most reliable for virtual lists ──
    // Focus the scroll container first, then press Page Down
    await this.page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;
      const allDivs = dialog.querySelectorAll('div');
      for (const div of allDivs) {
        const style = getComputedStyle(div);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        if (!isScrollable) continue;
        const scrollable = div.scrollHeight - div.clientHeight;
        if (scrollable > 30 && div.textContent?.includes('สมาชิก')) {
          div.focus();
          break;
        }
      }
    });
    await this.page.keyboard.press('PageDown');
    console.log(`     📜 Also pressed PageDown`);
    await this.delay(800);

    return true;
  }

  /**
   * 🔥 Scroll-Scan-Tick v7 (Human-like)
   * 
   * Like a REAL PERSON scrolling through the list:
   * 1. Read visible group names
   * 2. Compare each name with task progress targets
   * 3. If match → tick it
   * 4. Scroll down A LITTLE BIT (100-200px, like human)
   * 5. Wait, read again, repeat
   * 
   * NEVER report success if not actually ticked
   * NEVER click same group twice
   */
  async scrollScanTick(targetGroupNames, maxTicks = 20, onGroupTicked = null) {
    const effectiveMax = Math.min(maxTicks, targetGroupNames.length);
    console.log(`\n🎯 Scroll-Scan-Tick v7 (Human-like): ${targetGroupNames.length} targets (max ${effectiveMax})`);
    console.log(`  📋 Task progress targets:`);
    targetGroupNames.forEach((n, i) => console.log(`     ${i + 1}. "${n}"`));

    const ticked = [];
    const clickedNames = new Set();       // exact visible names we've clicked
    const clickedNormalized = new Set();  // normalized names — prevents re-click after scroll text changes
    const allSeenNames = new Set();

    // Wait for group list to load
    await this.delay(2000);

    // CRITICAL: Scroll page so group list is visible in viewport
    // (After clicking "ถัดไป", the group list may be off-screen below the form)
    await this.page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')].filter(
        s => s.textContent?.includes('สมาชิก') && s.textContent.length < 100
      );
      if (spans.length > 0) {
        spans[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await this.delay(1500);
    console.log(`  📍 Scrolled page to bring group list into viewport`);

    // Find where to position mouse for scrolling (center of group list, CLAMPED to viewport)
    const scrollPos = await this.page.evaluate(() => {
      const vpH = window.innerHeight;
      const vpW = window.innerWidth;
      // Find the group list area by looking for "สมาชิก" spans
      const spans = [...document.querySelectorAll('span')].filter(
        s => s.textContent?.includes('สมาชิก') && s.textContent.length < 100
      );
      if (spans.length > 0) {
        // Use the FIRST visible span's position (not average — average can be off-screen)
        for (const sp of spans) {
          const r = sp.getBoundingClientRect();
          if (r.y > 0 && r.y < vpH) {
            return { x: Math.round(r.x + 50), y: Math.round(r.y) };
          }
        }
        // Fallback: use first span but CLAMP to viewport (avoid negative or off-screen)
        const first = spans[0].getBoundingClientRect();
        return {
          x: Math.max(50, Math.min(Math.round(first.x + 50), vpW - 50)),
          y: Math.max(100, Math.min(Math.round(first.y), vpH - 100)),
        };
      }
      return { x: Math.round(vpW / 2), y: Math.round(vpH / 2) };
    });

    // Move mouse to group list area (needed for wheel scroll to work)
    await this.page.mouse.move(scrollPos.x, scrollPos.y);
    console.log(`  🖱️ Mouse at (${scrollPos.x}, ${scrollPos.y}) — ready to scroll`);

    let scrollCount = 0;
    const MAX_SCROLLS = 80; // max scrolls before giving up (increased for long lists)
    let noNewCount = 0;

    // ── Main loop: read → tick matches → scroll a little → repeat ──
    while (ticked.length < effectiveMax && scrollCount < MAX_SCROLLS) {
      if (!this.isRunning) break;
      while (this.isPaused && this.isRunning) {
        await this.delay(1000);
      }

      // Step 1: Read currently visible group names
      const visibleNames = await this.scanVisibleGroupNames();

      // Track if we see new groups (to detect end of list)
      let foundNew = false;
      for (const name of visibleNames) {
        if (!allSeenNames.has(name)) {
          allSeenNames.add(name);
          foundNew = true;
        }
      }

      // Step 2: For each visible group, check if it matches a target
      for (const visibleName of visibleNames) {
        if (ticked.length >= effectiveMax) break;
        if (!this.isRunning) break;
        if (clickedNames.has(visibleName)) continue;
        // Also check normalized name — prevents re-click when scroll causes minor text differences
        const normVisible = this.normalizeGroupName(visibleName);
        if (clickedNormalized.has(normVisible)) continue;

        // Does this visible group match any target in task progress?
        // PRIORITY: exact normalized match first, then fuzzy
        let matchedTarget = targetGroupNames.find(t =>
          !ticked.includes(t) && this.normalizeGroupName(t) === normVisible
        );
        if (!matchedTarget) {
          matchedTarget = targetGroupNames.find(t =>
            !ticked.includes(t) && this.isGroupNameMatch(t, visibleName)
          );
        }
        if (!matchedTarget) continue; // Not a target → skip

        // Match found! Tick it — pass VISIBLE NAME (exact DOM match) not target name
        console.log(`  🔍 Match: "${visibleName}" = target "${matchedTarget}"`);
        const { result, fbName } = await this.tickGroupDirect(visibleName);

        if (result === 'ticked') {
          console.log(`  ✅ [${ticked.length + 1}/${effectiveMax}] Ticked "${matchedTarget}"`);
          ticked.push(matchedTarget);
          clickedNames.add(visibleName);
          clickedNormalized.add(normVisible);
          clickedNormalized.add(this.normalizeGroupName(matchedTarget));
          if (fbName && fbName !== visibleName) {
            clickedNames.add(fbName);
            clickedNormalized.add(this.normalizeGroupName(fbName));
          }
          if (onGroupTicked) {
            try { onGroupTicked(matchedTarget, fbName || visibleName); } catch (e) {}
          }
        } else {
          console.log(`  ⚠️ Could not tick "${matchedTarget}" — element not found`);
        }
      }

      // Check if all done
      if (ticked.length >= effectiveMax || ticked.length >= targetGroupNames.length) {
        console.log(`  🎉 All ${ticked.length} targets ticked!`);
        break;
      }

      // Step 3: Scroll down using scrollGroupList (multi-strategy, works with virtual list)
      if (!foundNew) {
        noNewCount++;
      } else {
        noNewCount = 0;
      }

      if (noNewCount >= 30) {
        console.log(`  ⛔ No new groups after ${noNewCount} scrolls — end of list`);
        break;
      }

      // Use the full multi-strategy scroll (scrollIntoView + container.scrollTop + mouse.wheel + WheelEvent)
      await this.scrollGroupList();
      // Human-like wait after scroll
      await this.delay(600 + Math.floor(Math.random() * 400));

      scrollCount++;

      // Log every 5 scrolls
      if (scrollCount % 5 === 0) {
        const remaining = targetGroupNames.filter(t => !ticked.includes(t));
        console.log(`  📜 Scroll #${scrollCount}: ${ticked.length} ticked, ${allSeenNames.size} seen, ${remaining.length} remaining`);
      }
    }

    const notFound = targetGroupNames.filter(t => !ticked.includes(t));

    console.log(`\n📊 Scroll-Scan-Tick v7 Results:`);
    console.log(`  ✅ Ticked: ${ticked.length}/${targetGroupNames.length}`);
    if (notFound.length > 0) {
      console.log(`  ❌ Not found (${notFound.length}):`);
      notFound.forEach(n => console.log(`     - "${n}"`));
    }
    console.log(`  📜 Total seen: ${allSeenNames.size} | Scrolls: ${scrollCount}`);

    return { ticked, skipped: [...notFound], tickFailed: [], notFound };
  }

  // ============================================
  // POST-PUBLISH: "ลงประกาศในที่อื่นๆ" FLOW
  // After initial publish, add remaining groups
  // ============================================

  /**
   * Open "ลงประกาศในที่อื่นๆ" dialog on a published listing
   * Flow: click "..." → click "ลงประกาศในที่อื่นๆ" → wait for dialog
   * Returns: true if dialog opened successfully
   */
  async listInMorePlaces() {
    console.log('\n📌 Opening "ลงประกาศในที่อื่นๆ" dialog...');

    // Wait for the listing page to fully load after publish
    await this.delay(3000);

    // Step 1: Find and click the "..." (more options) button
    // Look for a button with "..." text or aria-label containing "เพิ่มเติม" or "more"
    const moreBtn = await this.page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="button"], button, [aria-label]');
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();

        // Match "..." button or "อื่นๆ" or "more" or "เพิ่มเติม"
        if (text === '···' || text === '...' || text === '•••' || text === '⋯' ||
            ariaLabel.includes('เพิ่มเติม') || ariaLabel.includes('more') || ariaLabel.includes('อื่นๆ') ||
            title.includes('เพิ่มเติม') || title.includes('more')) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.y > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: text.substring(0, 20) };
          }
        }
      }

      // Fallback: look for SVG with 3 dots pattern (commonly used for "..." icon)
      const svgs = document.querySelectorAll('svg');
      for (const svg of svgs) {
        const parent = svg.closest('[role="button"], button, a');
        if (!parent) continue;
        const circles = svg.querySelectorAll('circle');
        if (circles.length === 3) {
          const rect = parent.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: '3-dot-svg' };
          }
        }
      }

      return { found: false };
    });

    if (!moreBtn.found) {
      console.log('⚠️ "..." button not found on listing page');
      return false;
    }

    console.log(`  → Clicking "..." button at (${moreBtn.x}, ${moreBtn.y}) [${moreBtn.text}]`);
    await this.page.mouse.click(moreBtn.x, moreBtn.y);
    await this.humanDelay(1000, 1500);

    // Step 2: Find and click "ลงประกาศในที่อื่นๆ" in the dropdown menu
    const listMoreBtn = await this.page.evaluate(() => {
      // Search in menus, popups, dialogs
      const allElements = document.querySelectorAll('[role="menuitem"], [role="button"], [role="link"], a, div, span');
      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text.includes('ลงประกาศในที่อื่น') || text.includes('List in more') || text.includes('ลงประกาศใน')) {
          // Make sure it's a clickable element, not a container with many children
          if (el.children && el.children.length > 5) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.width < 500) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: text.substring(0, 30) };
          }
        }
      }
      return { found: false };
    });

    if (!listMoreBtn.found) {
      console.log('⚠️ "ลงประกาศในที่อื่นๆ" menu item not found');
      // Try closing the menu by pressing Escape
      await this.page.keyboard.press('Escape');
      return false;
    }

    console.log(`  → Clicking "ลงประกาศในที่อื่นๆ" at (${listMoreBtn.x}, ${listMoreBtn.y})`);
    await this.page.mouse.click(listMoreBtn.x, listMoreBtn.y);
    await this.humanDelay(2000, 3000);

    // Step 3: Verify dialog opened — look for group list with "สมาชิก" text
    const dialogReady = await this.page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      return bodyText.includes('สมาชิก') && (
        bodyText.includes('ลงประกาศในที่อื่น') ||
        bodyText.includes('ลงประกาศในกลุ่ม') ||
        bodyText.includes('สูงสุด') ||
        document.querySelector('[role="dialog"]') !== null
      );
    });

    if (!dialogReady) {
      console.log('⚠️ Dialog did not open after clicking "ลงประกาศในที่อื่นๆ"');
      return false;
    }

    console.log('✅ "ลงประกาศในที่อื่นๆ" dialog opened!');
    return true;
  }

  /**
   * Click "โพสต์" button inside the "ลงประกาศในที่อื่นๆ" dialog
   */
  async clickPostInDialog() {
    console.log('📤 Clicking "โพสต์" in dialog...');
    await this.delay(1000);

    const postBtn = await this.page.evaluate(() => {
      // Look in dialog first
      const dialog = document.querySelector('[role="dialog"]');
      const root = dialog || document;
      const buttons = root.querySelectorAll('[role="button"], button');

      for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '');

        if (text === 'โพสต์' || text === 'Post' || text === 'เผยแพร่' ||
            ariaLabel === 'โพสต์' || ariaLabel === 'Post') {
          const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
          if (!isDisabled) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text };
            }
          }
        }
      }
      return { found: false };
    });

    if (!postBtn.found) {
      console.log('⚠️ "โพสต์" button not found or disabled');
      return false;
    }

    await this.page.mouse.click(postBtn.x, postBtn.y);
    console.log(`✅ Clicked "โพสต์" button`);
    await this.delay(3000);
    return true;
  }

  // ============================================
  // SUBMIT / PUBLISH
  // ============================================

  async clickPublish() {
    console.log('🔄 Publishing...');

    await this.delay(2000);

    // Try to find and click publish button
    const publishBox = await this.page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="button"], button');
      
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';

        if (text === 'เผยแพร่' || text === 'Publish' || text === 'ประกาศ' ||
            ariaLabel === 'เผยแพร่' || ariaLabel === 'Publish' || ariaLabel === 'ประกาศ') {
          const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
          if (!isDisabled) {
            const rect = btn.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text };
          }
        }
      }
      return { found: false };
    });

    if (!publishBox.found) {
      console.log('⚠️ Publish button not found or disabled');
      return false;
    }

    // Use real mouse click instead of JS click for reliability
    await this.page.mouse.click(publishBox.x, publishBox.y);
    console.log(`📤 Clicked "${publishBox.text}" button`);

    // Wait and verify publish succeeded
    // Check for: URL change, success toast, or error dialog
    const startUrl = this.page.url();
    let verified = false;

    for (let attempt = 0; attempt < 10; attempt++) {
      await this.delay(1500);

      const result = await this.page.evaluate((origUrl) => {
        // Check 1: URL changed (navigated away from create page)
        if (window.location.href !== origUrl && !window.location.href.includes('/create')) {
          return { status: 'success', reason: 'url_changed' };
        }

        // Check 2: Success toast/notification visible
        const allText = document.body.innerText || '';
        if (allText.includes('ลงประกาศสำเร็จ') || allText.includes('Your listing is published') || 
            allText.includes('ลงประกาศแล้ว') || allText.includes('Published')) {
          return { status: 'success', reason: 'success_toast' };
        }

        // Check 3: Error dialog appeared
        if (allText.includes('ไม่สามารถ') || allText.includes("can't") || 
            allText.includes('ผิดพลาด') || allText.includes('error')) {
          // Check if it's a real error dialog, not just page text
          const dialogs = document.querySelectorAll('[role="dialog"]');
          for (const d of dialogs) {
            const dText = d.textContent || '';
            if (dText.includes('ไม่สามารถ') || dText.includes('ผิดพลาด')) {
              return { status: 'error', reason: 'error_dialog' };
            }
          }
        }

        // Check 4: Publish button disappeared (means form was submitted)
        const buttons = document.querySelectorAll('[role="button"], button');
        let publishStillVisible = false;
        for (const btn of buttons) {
          const t = btn.textContent?.trim() || '';
          if (t === 'เผยแพร่' || t === 'Publish' || t === 'ประกาศ') {
            publishStillVisible = true;
            break;
          }
        }
        if (!publishStillVisible) {
          return { status: 'success', reason: 'button_gone' };
        }

        return { status: 'pending' };
      }, startUrl);

      if (result.status === 'success') {
        console.log(`✅ Publish verified: ${result.reason}`);
        verified = true;
        break;
      } else if (result.status === 'error') {
        console.log(`❌ Publish failed: ${result.reason}`);
        return false;
      }
      // else pending — keep waiting
    }

    if (!verified) {
      // Timeout — assume success if no error detected (FB can be slow)
      console.log('⏳ Publish verification timed out — assuming success');
    }

    return true;
  }

  // ============================================
  // CAPTION GENERATION
  // ============================================

  async generateCaption(property, style = 'friendly') {
    if (this.anthropic) {
      try {
        const prompt = `คุณเป็นนายหน้าอสังหาริมทรัพย์มืออาชีพ ช่วยเขียนแคปชั่นโพสต์ Facebook สำหรับประกาศ${property.listingType === 'rent' ? 'ให้เช่า' : 'ขาย'}อสังหาริมทรัพย์:

ข้อมูลสินทรัพย์:
- ชื่อ: ${property.title}
- ประเภท: ${property.type}
- ราคา: ${new Intl.NumberFormat('th-TH').format(property.price)} บาท${property.listingType === 'rent' ? '/เดือน' : ''}
- ที่ตั้ง: ${property.location}, ${property.district}, ${property.province}
- พื้นที่: ${property.size} ตร.ม.
- ห้องนอน: ${property.bedrooms}
- ห้องน้ำ: ${property.bathrooms}

สไตล์: ${style === 'friendly' ? 'เป็นกันเอง ใช้ emoji' : style === 'professional' ? 'มืออาชีพ เป็นทางการ' : 'สบายๆ'}

กติกา:
- ใช้ภาษาไทย กระชับ ไม่เกิน 200 คำ
- ใส่ emoji ให้ดูน่าสนใจ
- ใส่ hashtag 3-5 อัน
- เขียนให้แตกต่างจากครั้งก่อน (เปลี่ยนมุมมอง/เรียงลำดับ/คำ)`;

        const response = await this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        });
        return response.content[0].text;
      } catch (error) {
        console.error('Claude API error:', error.message);
      }
    }

    // Template fallback
    const priceFormatted = new Intl.NumberFormat('th-TH').format(property.price);
    const isRent = property.listingType === 'rent';
    return `🏠 ${property.title}\n\n💰 ${isRent ? 'เช่า' : 'ขาย'} ${priceFormatted} บาท${isRent ? '/เดือน' : ''}\n📍 ${property.location}\n🛏️ ${property.bedrooms} ห้องนอน | 🚿 ${property.bathrooms} ห้องน้ำ\n📐 ${property.size} ตร.ม.\n\n📞 ${property.contactPhone || ''}\n\n#อสังหาริมทรัพย์ #${isRent ? 'ให้เช่า' : 'ขาย'}`;
  }

  // ============================================
  // 🚀 MAIN AUTOMATION ENGINE
  // Marketplace Post → Tick Groups (batches of 20)
  // ============================================

  async startMarketplaceAutomation(config) {
    const {
      property,
      groups,
      caption,
      images,
      delayMinutes,
      delaySeconds,
      captionStyle = 'friendly',
      browser = 'chrome',
      userPackage = 'free',
      claudeApiKey,
    } = config;

    // Reset if stuck
    if (this.isRunning) {
      console.log('⚠️ Previous automation stuck, resetting...');
      this.isRunning = false;
      this.isPaused = false;
    }

    this.isRunning = true;
    this.isPaused = false;

    // Initialize Claude
    if (claudeApiKey) this.initAnthropicClient(claudeApiKey);

    // ── PRE-FLIGHT CHECK ──
    // เช็ค daily limit + กรองกลุ่มซ้ำก่อนเริ่ม
    const preflight = this.tracker.preflightCheck(
      property.id,
      groups.map(g => g.id),
      userPackage
    );

    console.log(`\n📋 PRE-FLIGHT CHECK:`);
    console.log(`   Daily limit: ${preflight.dailyUsed}/${preflight.dailyLimit} used`);
    console.log(`   Remaining: ${preflight.dailyRemaining}`);
    console.log(`   Requested: ${preflight.totalRequested} groups`);
    console.log(`   Can post: ${preflight.canPost.length}`);
    console.log(`   Skipped (duplicate): ${preflight.skippedDuplicate.length}`);
    console.log(`   Skipped (over limit): ${preflight.skippedOverLimit.length}`);

    if (!preflight.canProceed) {
      this.isRunning = false;
      const reason = preflight.dailyRemaining === 0
        ? `ถึงลิมิตวันนี้แล้ว (${preflight.dailyLimit} โพสต์) รีเซ็ตตี 5`
        : `กลุ่มทั้งหมดถูกโพสต์ไปแล้ววันนี้`;
      return {
        success: false,
        error: reason,
        errorType: 'limit_reached',
        tasks: [],
        dailyStats: this.tracker.getTodayStats(userPackage),
      };
    }

    // Filter groups to only those that can be posted
    const allowedGroupIds = new Set(preflight.canPost);
    const filteredGroups = groups.filter(g => allowedGroupIds.has(g.id));

    // Record this automation run
    this.tracker.recordAutomationRun(property.id, filteredGroups.length);

    // Split filtered groups into batches of 20
    const BATCH_SIZE = 20;
    this.batches = [];
    for (let i = 0; i < filteredGroups.length; i += BATCH_SIZE) {
      this.batches.push(filteredGroups.slice(i, i + BATCH_SIZE));
    }
    this.totalBatches = this.batches.length;
    this.currentBatch = 0;
    this.totalSteps = filteredGroups.length;
    this.currentStep = 0;

    // Initialize tasks — include skipped groups too for visibility
    this.tasks = [];

    // Add skipped duplicate groups
    for (const groupId of preflight.skippedDuplicate) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        this.tasks.push({
          id: `skip-dup-${groupId}`,
          groupId: group.id,
          groupName: group.name,
          groupUrl: group.url,
          status: 'failed',
          message: '⏭️ ข้าม — โพสต์ไปแล้ววันนี้',
          batchNumber: 0,
        });
      }
    }

    // Add skipped over-limit groups
    for (const groupId of preflight.skippedOverLimit) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        this.tasks.push({
          id: `skip-limit-${groupId}`,
          groupId: group.id,
          groupName: group.name,
          groupUrl: group.url,
          status: 'failed',
          message: '⏭️ ข้าม — เกินลิมิตรายวัน',
          batchNumber: 0,
        });
      }
    }

    // Add actual posting tasks
    filteredGroups.forEach((group, index) => {
      this.tasks.push({
        id: `task-${index}`,
        groupId: group.id,
        groupName: group.name,
        groupUrl: group.url,
        status: 'pending',
        message: '',
        batchNumber: Math.floor(index / BATCH_SIZE) + 1,
      });
    });

    // Track offset: skipped tasks come first in the array
    const skippedOffset = preflight.skippedDuplicate.length + preflight.skippedOverLimit.length;
    // totalSteps = only actual posting tasks (for accurate progress)
    this.totalSteps = filteredGroups.length;

    console.log(`\n🚀 Starting MARKETPLACE Automation`);
    console.log(`📦 ${filteredGroups.length} groups → ${this.totalBatches} batches (max 20/batch)`);
    if (preflight.skippedDuplicate.length > 0) {
      console.log(`⏭️ Skipped ${preflight.skippedDuplicate.length} duplicate groups`);
    }
    console.log(`🌐 Browser: ${browser}`);
    // Determine delay: use delaySeconds if provided, otherwise fall back to delayMinutes
    const useSeconds = typeof delaySeconds === 'number' && delaySeconds > 0;
    const batchDelayLabel = useSeconds ? `${delaySeconds} seconds (+2-5s random)` : `${delayMinutes || 5} minutes`;
    console.log(`⏱️ Delay between batches: ${batchDelayLabel}`);
    console.log(`📦 Package: ${userPackage}`);

    try {
      // Initialize browser
      if (!this.browser) {
        try {
          await this.initialize(browser);
        } catch (initError) {
          this.isRunning = false;
          return { success: false, error: `ไม่สามารถเปิด Browser: ${initError.message}`, tasks: this.tasks };
        }
      }

      // Check login
      const isLoggedIn = await this.checkLogin();
      if (!isLoggedIn) {
        this.isRunning = false;
        return {
          success: false,
          error: 'ยังไม่ได้ Login',
          errorType: 'login_required',
          message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดอยู่',
          tasks: [],
        };
      }

      // Process each batch
      for (let batchIdx = 0; batchIdx < this.batches.length; batchIdx++) {
        if (!this.isRunning) break;

        while (this.isPaused && this.isRunning) {
          await this.delay(1000);
        }

        const batch = this.batches[batchIdx];
        this.currentBatch = batchIdx + 1;

        console.log(`\n═══════════════════════════════════════`);
        console.log(`📦 Batch ${this.currentBatch}/${this.totalBatches} (${batch.length} groups)`);
        console.log(`═══════════════════════════════════════`);

        // Mark batch tasks as in_progress (offset by skipped tasks)
        const batchStartIdx = skippedOffset + (batchIdx * BATCH_SIZE);
        for (let i = 0; i < batch.length; i++) {
          if (this.tasks[batchStartIdx + i]) {
            this.tasks[batchStartIdx + i].status = 'in_progress';
            this.tasks[batchStartIdx + i].message = 'กำลังเตรียมโพสต์...';
          }
        }

        try {
          // ── CHECKPOINT CHECK before each batch ──
          const checkpoint = await this.detectCheckpoint();
          if (checkpoint.detected) {
            console.log(`🚨 ${checkpoint.type} detected — stopping automation`);
            // Mark all remaining tasks as failed
            for (let i = 0; i < batch.length; i++) {
              const taskIdx = batchStartIdx + i;
              if (this.tasks[taskIdx]) {
                this.tasks[taskIdx].status = 'failed';
                this.tasks[taskIdx].message = `⚠️ Facebook ${checkpoint.type}: ${checkpoint.reason}`;
              }
            }
            // Stop entire automation
            this.isRunning = false;
            break;
          }

          // Step 1: Navigate to Marketplace create
          await this.navigateToMarketplaceCreate();

          // Step 2: Fill property form
          await this.fillPropertyForm(property, images);

          // Step 3: Click Next → Group selection page
          await this.clickNext();

          // Step 4: Scroll-Scan-Tick → Find and tick groups by name
          const targetNames = batch.map(g => g.name);
          // Callback: update task status ONLY when VERIFIED ticked
          const onGroupTicked = (targetName, fbName) => {
            const groupIdx = batch.findIndex(g => g.name === targetName);
            if (groupIdx !== -1) {
              const taskIdx = batchStartIdx + groupIdx;
              if (this.tasks[taskIdx]) {
                this.tasks[taskIdx].status = 'in_progress';
                this.tasks[taskIdx].message = `☑️ ติ๊กแล้ว ✓ (${fbName})`;
              }
            }
          };
          const { ticked, tickFailed = [], notFound = [] } = await this.scrollScanTick(targetNames, batch.length, onGroupTicked);

          console.log(`📋 Batch ${this.currentBatch}: ticked ${ticked.length}/${batch.length}, tickFailed ${tickFailed.length}, notFound ${notFound.length}`);

          // Update task statuses — 3 cases: ticked / tick_failed / not_found
          for (let i = 0; i < batch.length; i++) {
            const taskIdx = batchStartIdx + i;
            if (!this.tasks[taskIdx]) continue;
            const groupName = batch[i].name;

            if (ticked.includes(groupName)) {
              this.tasks[taskIdx].status = 'in_progress';
              this.tasks[taskIdx].message = '☑️ ติ๊กแล้ว ✓ รอเผยแพร่...';
              this.currentStep = (batchIdx * BATCH_SIZE) + i + 1;
            } else if (tickFailed.includes(groupName)) {
              this.tasks[taskIdx].status = 'failed';
              this.tasks[taskIdx].message = '❌ คลิกแล้วแต่ checkbox ไม่ติ๊ก — ลองใหม่';
            } else {
              // Keep as pending — will try again via "ลงประกาศในที่อื่นๆ" after publish
              this.tasks[taskIdx].status = 'pending';
              this.tasks[taskIdx].message = '⏳ รอลงประกาศเพิ่มหลังโพสต์...';
            }
          }

          // Step 5: Publish if any groups were ticked
          let batchSuccess = 0;
          if (ticked.length > 0) {
            const published = await this.clickPublish();

            for (let i = 0; i < batch.length; i++) {
              const taskIdx = batchStartIdx + i;
              if (!this.tasks[taskIdx]) continue;
              if (this.tasks[taskIdx].status === 'in_progress') {
                if (published) {
                  this.tasks[taskIdx].status = 'completed';
                  this.tasks[taskIdx].message = 'โพสต์สำเร็จ ✅';
                  batchSuccess++;
                  this.tracker.recordPosting(property.id, batch[i].id, batch[i].name, true);
                } else {
                  this.tasks[taskIdx].status = 'failed';
                  this.tasks[taskIdx].message = 'เผยแพร่ไม่สำเร็จ';
                  this.tracker.recordPosting(property.id, batch[i].id, batch[i].name, false);
                }
              } else if (this.tasks[taskIdx].status === 'failed') {
                this.tracker.recordSkipped(property.id, batch[i].id, batch[i].name, 'not_found');
              }
            }

            // Wait for page to fully settle after publish
            console.log('⏳ Waiting for page to settle after publish...');
            await this.delay(5000);

            // ── Step 6: POST-PUBLISH — add remaining groups via "ลงประกาศในที่อื่นๆ" ──
            const pendingGroups = [];
            for (let i = 0; i < batch.length; i++) {
              const taskIdx = batchStartIdx + i;
              if (this.tasks[taskIdx] && this.tasks[taskIdx].status === 'pending') {
                pendingGroups.push({ index: i, taskIdx, group: batch[i] });
              }
            }

            if (pendingGroups.length > 0 && published && this.isRunning) {
              console.log(`\n📌 ${pendingGroups.length} groups still pending — trying "ลงประกาศในที่อื่นๆ"...`);
              pendingGroups.forEach(pg => {
                this.tasks[pg.taskIdx].message = '🔄 กำลังเปิดหน้าลงประกาศเพิ่ม...';
              });

              const dialogOpened = await this.listInMorePlaces();

              if (dialogOpened) {
                const pendingNames = pendingGroups.map(pg => pg.group.name);
                const onPostPublishTick = (targetName, fbName) => {
                  const pg = pendingGroups.find(p => p.group.name === targetName);
                  if (pg) {
                    this.tasks[pg.taskIdx].status = 'in_progress';
                    this.tasks[pg.taskIdx].message = `☑️ ติ๊กแล้ว ✓ (${fbName})`;
                  }
                };

                const postResult = await this.scrollScanTick(pendingNames, pendingNames.length, onPostPublishTick);

                console.log(`📋 Post-publish tick: ${postResult.ticked.length}/${pendingNames.length}`);

                if (postResult.ticked.length > 0) {
                  // Click "โพสต์" in the dialog
                  const posted = await this.clickPostInDialog();

                  for (const pg of pendingGroups) {
                    if (postResult.ticked.includes(pg.group.name)) {
                      if (posted) {
                        this.tasks[pg.taskIdx].status = 'completed';
                        this.tasks[pg.taskIdx].message = 'โพสต์สำเร็จ ✅ (ลงเพิ่ม)';
                        batchSuccess++;
                        this.tracker.recordPosting(property.id, pg.group.id, pg.group.name, true);
                      } else {
                        this.tasks[pg.taskIdx].status = 'failed';
                        this.tasks[pg.taskIdx].message = '❌ ติ๊กแล้วแต่โพสต์ไม่สำเร็จ';
                      }
                    } else {
                      this.tasks[pg.taskIdx].status = 'failed';
                      this.tasks[pg.taskIdx].message = '❌ ไม่พบกลุ่มใน Marketplace';
                      this.tracker.recordSkipped(property.id, pg.group.id, pg.group.name, 'not_found');
                    }
                  }
                } else {
                  // No groups ticked in post-publish
                  for (const pg of pendingGroups) {
                    this.tasks[pg.taskIdx].status = 'failed';
                    this.tasks[pg.taskIdx].message = '❌ ไม่พบกลุ่มใน Marketplace';
                    this.tracker.recordSkipped(property.id, pg.group.id, pg.group.name, 'not_found');
                  }
                }

                await this.delay(3000);
              } else {
                console.log('⚠️ Could not open "ลงประกาศในที่อื่นๆ" dialog — marking pending as failed');
                for (const pg of pendingGroups) {
                  this.tasks[pg.taskIdx].status = 'failed';
                  this.tasks[pg.taskIdx].message = '❌ ไม่สามารถเปิดหน้าลงประกาศเพิ่ม';
                  this.tracker.recordSkipped(property.id, pg.group.id, pg.group.name, 'dialog_failed');
                }
              }
            }
          } else {
            console.log('⚠️ No groups ticked in this batch — skipping publish');
            // Mark all as failed since nothing was ticked
            for (let i = 0; i < batch.length; i++) {
              const taskIdx = batchStartIdx + i;
              if (this.tasks[taskIdx] && this.tasks[taskIdx].status !== 'failed') {
                this.tasks[taskIdx].status = 'failed';
                this.tasks[taskIdx].message = '❌ ไม่สามารถติ๊กกลุ่มได้';
              }
            }
          }

          // Record batch stats
          this.tracker.recordBatch(this.currentBatch, batch.length, batchSuccess);
          console.log(`✅ Batch ${this.currentBatch} done: ${batchSuccess} success, ${batch.length - batchSuccess} failed`);

        } catch (batchError) {
          console.error(`❌ Batch ${this.currentBatch} error:`, batchError.message);

          // ── RETRY ONCE ──
          // Check if it's a recoverable error (not checkpoint/captcha)
          const isRecoverable = !batchError.message?.includes('checkpoint') &&
                                !batchError.message?.includes('captcha') &&
                                !batchError.message?.includes('login');

          if (isRecoverable && this.isRunning) {
            console.log(`🔄 Retrying batch ${this.currentBatch}...`);
            for (let i = 0; i < batch.length; i++) {
              const taskIdx = batchStartIdx + i;
              if (this.tasks[taskIdx]) {
                this.tasks[taskIdx].status = 'in_progress';
                this.tasks[taskIdx].message = '🔄 ลองใหม่...';
              }
            }

            try {
              await this.delay(5000);
              await this.navigateToMarketplaceCreate();
              await this.fillPropertyForm(property, images);
              await this.clickNext();

              const targetNames = batch.map(g => g.name);
              const onGroupTickedRetry = (targetName, fbName) => {
                const groupIdx = batch.findIndex(g => g.name === targetName);
                if (groupIdx !== -1) {
                  const taskIdx = batchStartIdx + groupIdx;
                  if (this.tasks[taskIdx]) {
                    this.tasks[taskIdx].status = 'in_progress';
                    this.tasks[taskIdx].message = `☑️ ติ๊กเลือกแล้ว (retry: ${fbName})`;
                  }
                }
              };
              const retryResult = await this.scrollScanTick(targetNames, batch.length, onGroupTickedRetry);

              if (retryResult.ticked.length > 0) {
                const published = await this.clickPublish();
                for (let i = 0; i < batch.length; i++) {
                  const taskIdx = batchStartIdx + i;
                  if (!this.tasks[taskIdx]) continue;
                  const groupName = batch[i].name;
                  if (retryResult.ticked.includes(groupName) && published) {
                    this.tasks[taskIdx].status = 'completed';
                    this.tasks[taskIdx].message = 'โพสต์สำเร็จ ✅ (retry)';
                    this.tracker.recordPosting(property.id, batch[i].id, batch[i].name, true);
                  } else {
                    this.tasks[taskIdx].status = 'failed';
                    this.tasks[taskIdx].message = 'ลองใหม่แล้วยังไม่สำเร็จ';
                    this.tracker.recordPosting(property.id, batch[i].id, batch[i].name, false);
                  }
                }
                this.tracker.recordBatch(this.currentBatch, batch.length, retryResult.ticked.length);
                continue; // Skip the failure marking below
              }
            } catch (retryError) {
              console.error(`❌ Retry also failed:`, retryError.message);
            }
          }

          // Mark remaining as failed
          for (let i = 0; i < batch.length; i++) {
            const taskIdx = batchStartIdx + i;
            if (!this.tasks[taskIdx]) continue;
            if (this.tasks[taskIdx].status !== 'completed') {
              this.tasks[taskIdx].status = 'failed';
              this.tasks[taskIdx].message = batchError.message;
              this.tracker.recordPosting(property.id, batch[i].id, batch[i].name, false);
            }
          }
        }

        // Delay between batches (except last)
        if (batchIdx < this.batches.length - 1 && this.isRunning) {
          const nextBatch = this.batches[batchIdx + 1];
          let delayMs;
          if (useSeconds) {
            // Seconds mode: user's value + random 2-5 seconds jitter
            const jitter = 2000 + Math.floor(Math.random() * 3000); // 2-5s
            delayMs = (delaySeconds * 1000) + jitter;
            console.log(`\n⏳ Waiting ${delaySeconds}s + ${(jitter/1000).toFixed(1)}s jitter = ${(delayMs/1000).toFixed(1)}s before batch ${batchIdx + 2} (${nextBatch.length} groups)...`);
          } else {
            // Minutes mode (legacy fallback)
            delayMs = ((delayMinutes || 5) * 60 + (Math.random() * 60 - 30)) * 1000;
            console.log(`\n⏳ Waiting ~${delayMinutes || 5} min before batch ${batchIdx + 2} (${nextBatch.length} groups)...`);
          }
          const delaySec = Math.round(delayMs / 1000);
          
          // Update pending tasks to show waiting message
          const nextBatchStartIdx = skippedOffset + ((batchIdx + 1) * BATCH_SIZE);
          for (let i = 0; i < nextBatch.length; i++) {
            if (this.tasks[nextBatchStartIdx + i]) {
              this.tasks[nextBatchStartIdx + i].message = `⏳ รอ batch ถัดไป (~${delaySec} วินาที)`;
            }
          }

          await this.delay(delayMs);
          console.log(`✅ Delay done, starting batch ${batchIdx + 2}...`);
        }
      }

      this.isRunning = false;
      this.currentTask = null;

      const completed = this.tasks.filter(t => t.status === 'completed').length;
      const failed = this.tasks.filter(t => t.status === 'failed').length;

      console.log(`\n✅ Marketplace Automation Complete!`);
      console.log(`   ✅ Success: ${completed} groups`);
      console.log(`   ❌ Failed: ${failed} groups`);
      console.log(`   📦 Batches: ${this.totalBatches}`);

      return {
        success: true,
        message: `โพสต์สำเร็จ ${completed} กลุ่ม, ล้มเหลว ${failed} กลุ่ม (${this.totalBatches} batches)`,
        tasks: this.tasks,
        completed,
        failed,
        totalBatches: this.totalBatches,
      };

    } catch (error) {
      this.isRunning = false;
      console.error('Marketplace automation error:', error);
      return { success: false, error: error.message, tasks: this.tasks };
    }
  }

  // ============================================
  // STATUS & CONTROLS
  // ============================================

  getStatus() {
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const failed = this.tasks.filter(t => t.status === 'failed').length;
    const pending = this.tasks.filter(t => t.status === 'pending').length;

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
      currentTask: this.currentTask,
      tasks: this.tasks,
      browserConnected: this.isBrowserConnected(),
      mode: 'marketplace',
      summary: { completed, failed, pending, total: this.tasks.length },
    };
  }

  pause() {
    this.isPaused = true;
    console.log('⏸️ Marketplace automation paused');
  }

  resume() {
    this.isPaused = false;
    console.log('▶️ Marketplace automation resumed');
  }

  async stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.tasks = [];
    this.batches = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    this.currentBatch = 0;
    this.totalBatches = 0;

    // Don't close borrowed browser (it belongs to groupWorker)
    if (this.browser && !this.borrowedBrowser) {
      try { await this.browser.close(); } catch (e) {}
    }
    this.browser = null;
    this.page = null;
    this.borrowedBrowser = false;

    console.log('🛑 Marketplace automation stopped');
  }

  async close() {
    await this.stop();
  }
}

// Factory function — creates a new worker per userId (no more singleton)
export function createMarketplaceWorkerForUser(userId) {
  return new MarketplaceWorker(userId);
}
