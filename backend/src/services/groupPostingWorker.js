import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';

// Anthropic SDK is optional - only load if available
let Anthropic = null;
try {
  const anthropicModule = await import('@anthropic-ai/sdk');
  Anthropic = anthropicModule.default;
} catch (e) {
  console.log('⚠️ Anthropic SDK not installed - Claude API features disabled');
}

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Browser executable paths for Windows
const BROWSER_PATHS = {
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ],
  firefox: [
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ],
  edge: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

// User data directories for each browser (to use existing login session)
const USER_DATA_DIRS = {
  chrome: process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data',
  edge: process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\User Data',
  firefox: process.env.APPDATA + '\\Mozilla\\Firefox\\Profiles',
};

function findBrowserPath(browser) {
  const paths = BROWSER_PATHS[browser] || BROWSER_PATHS.chrome;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export class GroupPostingWorker {
  constructor(userId = 'default') {
    this.userId = userId;
    this.browser = null;
    this.page = null;
    this.selectedBrowser = 'chrome';
    this.userDataDir = path.join(process.cwd(), 'profiles', userId, 'browser-profile');
    this.isRunning = false;
    this.isPaused = false;
    this.currentTask = null;
    this.tasks = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    this.anthropic = null;
    this.onPostResult = null; // callback: (propertyId, groupId, groupName, success) => void

    // Live log buffer + timing for frontend display
    this.logs = [];        // ring buffer — max 150 entries
    this.startTime = null; // Date.now() when automation starts
    this.endTime = null;   // Date.now() when automation ends/stops
    this.generatedCaptions = [];

    // Auto-init from env var if available
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey && Anthropic) {
      this.anthropic = new Anthropic({ apiKey: envKey });
    }
  }

  setPostResultCallback(cb) {
    this.onPostResult = cb;
  }

  // Initialize Anthropic client for caption generation
  initAnthropicClient(apiKey) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key && Anthropic) {
      this.anthropic = new Anthropic({ apiKey: key });
    }
  }

  // ── Live log helper ──
  // level: 'info' | 'success' | 'error' | 'warn' | 'start'
  addLog(msg, level = 'info') {
    const entry = {
      time: Date.now(),
      msg,
      level,
    };
    this.logs.push(entry);
    // Ring buffer: keep last 150 entries
    if (this.logs.length > 150) {
      this.logs = this.logs.slice(-150);
    }
  }

  // Helper function for delay
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Random delay between min and max seconds
  async randomDelay(minSeconds, maxSeconds) {
    const ms = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
    return this.delay(ms);
  }

  // Fuzzy match two group names (normalized, lowercase)
  fuzzyGroupNameMatch(name1, name2) {
    if (!name1 || !name2) return false;
    const words1 = name1.split(/\s+/).filter(w => w.length > 1);
    const words2 = name2.split(/\s+/).filter(w => w.length > 1);
    if (words1.length === 0 || words2.length === 0) return false;
    const matches = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
    return matches.length / Math.max(words1.length, words2.length) >= 0.4;
  }

  // ============================================
  // BUY/SELL GROUP HELPERS (accept page param for multi-tab)
  // Adapted from marketplaceWorker.js patterns
  // ============================================

  mapPropertyType(type) {
    // Return [Thai, English] — English must match Facebook's EXACT dropdown options:
    // Facebook EN options: "House", "Townhouse", "Flat/apartment", "Room only"
    const typeMap = {
      'condo': ['อพาร์ทเมนท์', 'Flat', 'Flat/apartment', 'Apartment'],
      'house': ['บ้าน', 'House'],
      'townhouse': ['ทาวน์เฮาส์', 'Townhouse'],
      'apartment': ['อพาร์ทเมนท์', 'Flat', 'Flat/apartment', 'Apartment'],
      'land': ['บ้าน', 'House'],
      'commercial': ['อพาร์ทเมนท์', 'Flat', 'Flat/apartment', 'Apartment'],
    };
    return typeMap[type] || ['บ้าน', 'House'];
  }

  mapListingType(listingType) {
    // Return [Thai, English]
    return listingType === 'rent' ? ['ให้เช่า', 'For Rent'] : ['สำหรับขาย', 'For Sale'];
  }

  // Helper: click a button in the form dialog by keyword list, returns clicked text or null
  async _clickButtonInDialog(page, keywords) {
    try {
      // Use Puppeteer elementHandle.click() for reliable clicking
      const btnHandle = await page.evaluateHandle((kws) => {
        const _ds = document.querySelectorAll('[role="dialog"]');
        let _fd = null;
        for (const _d of _ds) {
          if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
          _fd = _d; break;
        }
        const scope = _fd || document;
        const buttons = scope.querySelectorAll('[role="button"], button');
        for (const btn of buttons) {
          const spans = btn.querySelectorAll('span');
          let text = '';
          for (const s of spans) {
            const t = (s.textContent || '').trim();
            if (kws.some(kw => t.toLowerCase() === kw.toLowerCase())) { text = t; break; }
          }
          if (!text) {
            const ft = (btn.textContent || '').trim();
            if (ft.length < 30 && kws.some(kw => ft.toLowerCase() === kw.toLowerCase())) text = ft;
          }
          if (!text) continue;
          const isDis = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
          if (isDis) continue;
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return btn;
        }
        return null;
      }, keywords);
      if (btnHandle.asElement()) {
        // Get button text before clicking
        const text = await page.evaluate(el => {
          for (const s of el.querySelectorAll('span')) { const t = (s.textContent || '').trim(); if (t.length > 0 && t.length < 30) return t; }
          return (el.textContent || '').trim().slice(0, 30);
        }, btnHandle);
        await btnHandle.asElement().click();
        await btnHandle.dispose();
        await this.delay(1000);
        return text;
      }
      await btnHandle.dispose();
    } catch (e) {
      console.log(`   ⚠️ _clickButtonInDialog error: ${e.message}`);
    }
    return null;
  }

  // Facebook uses clickable tabs/buttons for "For sale" / "For rent" — NOT a dropdown
  async selectListingTypeTab(page, listingType) {
    const isSale = listingType !== 'rent';
    const targetTexts = isSale
      ? ['สำหรับขาย', 'For sale', 'For Sale', 'Property for sale']
      : ['ให้เช่า', 'For rent', 'For Rent', 'Property for rent'];
    // Also define the OPPOSITE to detect if we need to switch
    const oppositeTexts = isSale
      ? ['ให้เช่า', 'For rent', 'For Rent', 'Property for rent']
      : ['สำหรับขาย', 'For sale', 'For Sale', 'Property for sale'];
    console.log(`  🔀 Selecting listing type: ${isSale ? 'SALE' : 'RENT'}...`);

    // ── PRE-SCAN: Scroll dialog to top to reveal listing type controls ──
    await page.evaluate(() => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      for (const _d of _ds) {
        if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
        const scrollable = _d.querySelector('[style*="overflow"], [class*="scroll"]') || _d;
        for (const el of [scrollable, ..._d.querySelectorAll('div')]) {
          if (el.scrollHeight > el.clientHeight + 50) { el.scrollTop = 0; break; }
        }
        break;
      }
    });
    await this.delay(800);

    // ── Strategy 0: Dump ALL comboboxes + interactive elements for debugging ──
    const formDump = await page.evaluate((targets, opposites) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) {
        if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
        _fd = _d; break;
      }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      const combos = [];
      for (const cb of scope.querySelectorAll('[role="combobox"]')) {
        const r = cb.getBoundingClientRect();
        combos.push({ text: (cb.textContent || '').trim().slice(0, 60), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      }
      // Also scan for any element with exact sale/rent text
      const saleRentEls = [];
      const allEls = scope.querySelectorAll('span, div, a, label, [role="button"], [role="tab"], [role="radio"], [role="option"], [tabindex]');
      for (const el of allEls) {
        const t = (el.textContent || '').trim();
        if (t.length < 3 || t.length > 30) continue;
        const tl = t.toLowerCase();
        const match = [...targets, ...opposites].some(x => tl === x.toLowerCase() || tl.includes(x.toLowerCase()));
        if (!match) continue;
        // Skip if text also contains other unrelated stuff
        if (/property|house|flat|townhouse|room|บ้าน|อพาร์ท|ทาวน์|or rent|or sale|หรือเช่า|หรือขาย|type of/i.test(t)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) continue;
        saleRentEls.push({ tag: el.tagName, role: el.getAttribute('role') || '', text: t, y: Math.round(r.y), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), tabindex: el.getAttribute('tabindex'), ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 40) });
      }
      return { combos, saleRentEls };
    }, targetTexts, oppositeTexts);
    console.log(`    📋 Form comboboxes: ${JSON.stringify(formDump.combos)}`);
    console.log(`    📋 Sale/rent elements: ${JSON.stringify(formDump.saleRentEls)}`);

    // ── Strategy 0: Check if a combobox already shows the correct listing type ──
    const ddLabels0 = ['Choose listing type', 'Listing type', 'เลือกประเภทรายการ', 'ประเภทรายการ'];
    const ddOpts0 = isSale
      ? ['For sale', 'For Sale', 'สำหรับขาย', 'Sale']
      : ['For rent', 'For Rent', 'ให้เช่า', 'Rent'];
    const comboValueCheck = await page.evaluate((targets, opposites, ddLabels) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) {
        if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
        _fd = _d; break;
      }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      const combos = scope.querySelectorAll('[role="combobox"]');
      for (const cb of combos) {
        const cbText = (cb.textContent || '').trim();
        if (!cbText || cbText.length > 40) continue;
        const cbLower = cbText.toLowerCase();
        // Skip property type, utility, and location comboboxes
        if (/house|flat|townhouse|room only|บ้าน|อพาร์ท|ทาวน์|ห้อง|washing|parking|air con|heating|เครื่องซัก|ที่จอดรถ|แอร์|type of property|ประเภทอสังหาริมทรัพย์|ประเภทของอสังหาริมทรัพย์/i.test(cbText)) continue;
        const matchesTarget = targets.some(t => cbLower.includes(t.toLowerCase()));
        const matchesOpposite = opposites.some(t => cbLower.includes(t.toLowerCase()));
        if (matchesTarget && matchesOpposite) continue;
        if (matchesTarget) return { alreadyCorrect: true, text: cbText };
        if (matchesOpposite) {
          const rect = cb.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0)
            return { needsChange: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: cbText };
        }
        const isPlaceholder = ddLabels.some(lbl => cbLower.includes(lbl.toLowerCase()));
        if (isPlaceholder) {
          const rect = cb.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0)
            return { isPlaceholder: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: cbText };
        }
      }
      // Also search: find label text then look for nearby combobox sibling
      const spans = scope.querySelectorAll('span');
      for (const span of spans) {
        const t = (span.textContent || '').trim();
        if (t.length > 50) continue;
        const tl = t.toLowerCase();
        if (!ddLabels.some(lbl => tl.includes(lbl.toLowerCase()))) continue;
        let parent = span;
        for (let i = 0; i < 8; i++) {
          if (!parent.parentElement) break;
          parent = parent.parentElement;
          if (parent.getAttribute('role') === 'dialog') break;
          const combo = parent.querySelector('[role="combobox"]');
          if (combo) {
            const cText = (combo.textContent || '').trim();
            // Skip property type combobox even when found via label
            if (/type of property|ประเภทอสังหาริมทรัพย์|ประเภทของอสังหาริมทรัพย์/i.test(cText)) continue;
            const cLow = cText.toLowerCase();
            const mT = targets.some(tt => cLow.includes(tt.toLowerCase()));
            const mO = opposites.some(tt => cLow.includes(tt.toLowerCase()));
            if (mT && !mO) return { alreadyCorrect: true, text: cText };
            const rect = combo.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              if (mO && !mT) return { needsChange: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: cText };
              return { isPlaceholder: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: cText };
            }
          }
        }
      }
      return { alreadyCorrect: false, needsChange: false };
    }, targetTexts, oppositeTexts, ddLabels0);

    if (comboValueCheck.alreadyCorrect) {
      console.log(`    ✅ Strategy 0: Listing type already correct in combobox: "${comboValueCheck.text}"`);
      return true;
    }
    if (comboValueCheck.needsChange || comboValueCheck.isPlaceholder) {
      const reason = comboValueCheck.needsChange ? 'wrong value' : 'placeholder';
      console.log(`    🔄 Strategy 0: Combobox has ${reason} "${comboValueCheck.text}" — clicking...`);
      await page.mouse.click(comboValueCheck.x, comboValueCheck.y);
      await this.delay(1500);
      for (const opt of ddOpts0) {
        const optClicked = await this._clickOptionInDropdown(page, opt);
        if (optClicked) { console.log(`    ✅ Listing type set via Strategy 0 combobox`); await this.delay(1800); return true; }
      }
      await page.keyboard.press('ArrowDown');
      await this.delay(800);
      for (const opt of ddOpts0) {
        const optClicked = await this._clickOptionInDropdown(page, opt);
        if (optClicked) { console.log(`    ✅ Listing type set via Strategy 0 combobox+ArrowDown`); await this.delay(1800); return true; }
      }
      const avail0 = await this._getVisibleOptions(page);
      console.log(`    ⚠️ Strategy 0: combobox opened but no option matched. Available: ${JSON.stringify(avail0)}`);
      await page.keyboard.press('Escape');
      await this.delay(300);
    } else {
      console.log(`    ℹ️ Strategy 0: No listing-type combobox detected`);
    }

    // ── Strategy 0.5: Click standalone For sale/For rent element if found ──
    if (formDump.saleRentEls.length > 0) {
      // Pick the best candidate: prefer role=tab/radio/button, then smallest text, then highest Y
      const ranked = formDump.saleRentEls
        .filter(e => targetTexts.some(t => e.text.toLowerCase().includes(t.toLowerCase())))
        .sort((a, b) => {
          const roleScore = (r) => ['tab', 'radio', 'button', 'option'].includes(r) ? 0 : 1;
          return roleScore(a.role) - roleScore(b.role) || a.text.length - b.text.length;
        });
      if (ranked.length > 0) {
        const best = ranked[0];
        console.log(`    📍 Strategy 0.5: Clicking ${best.tag}[role=${best.role}] "${best.text}" at y=${best.y}`);
        await page.mouse.click(best.x + best.w / 2, best.y + best.h / 2);
        await this.delay(2000);
        return true;
      }
    }

    const tabResult = await page.evaluate((targets, opposites) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) {
        if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
        _fd = _d; break;
      }
      const scope = _fd || document.querySelector('[role="main"]') || document;

      // Strategy 1: role="tab", role="radio", role="option"
      const tabRoles = scope.querySelectorAll('[role="tab"], [role="radio"], [role="option"], [role="menuitemradio"]');
      for (const tab of tabRoles) {
        const text = (tab.textContent || '').trim();
        if (targets.some(t => text === t || text.toLowerCase().includes(t.toLowerCase()))) {
          const selected = tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('aria-checked') === 'true';
          if (selected) return { found: true, alreadySelected: true, method: 'tab-role' };
          const rect = tab.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0)
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'tab-role', text };
        }
      }

      // Strategy 2: Find any span/div with exact target text — click it
      const allEls = scope.querySelectorAll('span, div, a, label');
      for (const el of allEls) {
        const text = (el.textContent || '').trim();
        // Must be a short text match (avoid matching long paragraphs)
        if (text.length > 40) continue;
        if (!targets.some(t => text === t || text.toLowerCase() === t.toLowerCase())) continue;
        if (el.closest('h1, h2, h3, h4, [role="heading"]')) continue;
        // Check if this element or parent is clickable
        const clickTarget = el.closest('[role="button"], [role="tab"], [role="radio"], button, a, label') || el;
        const rect = clickTarget.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'text-match', text };
        }
      }

      // Strategy 2.5: aria-label driven clickables (Facebook sometimes hides text)
      const clickables = scope.querySelectorAll('[role="button"], [role="tab"], [role="radio"], [role="option"], [role="menuitemradio"], button, a, [tabindex="0"]');
      const badPrefixes = ['next', 'post', 'publish', 'ถัดไป', 'โพสต์', 'add photo', 'เพิ่มรูป'];
      for (const el of clickables) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 12) continue;
        if (rect.y < -200 || rect.y > 1200) continue;

        const aria = (el.getAttribute('aria-label') || '').trim();
        const txt = (el.textContent || '').trim().slice(0, 60);
        const combined = `${aria} ${txt}`.toLowerCase();

        if (!combined) continue;
        if (badPrefixes.some(p => combined.startsWith(p))) continue;
        if (combined.includes('or rent') || combined.includes('or sale') || combined.includes('หรือเช่า') || combined.includes('หรือขาย')) continue;

        const matchesTarget = targets.some(t => combined.includes(t.toLowerCase()));
        const matchesOpp = opposites.some(t => combined.includes(t.toLowerCase()));
        if (!matchesTarget || matchesOpp) continue;

        const selected = el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true';
        if (selected) return { found: true, alreadySelected: true, method: 'aria-clickable', text: (aria || txt).slice(0, 60) };
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'aria-clickable', text: (aria || txt).slice(0, 60) };
      }

      // Strategy 3: Check if form header already shows correct type
      // Look for spans that contain the target text as part of a label
      // IMPORTANT: exclude category labels like "Property for sale or rent" which contain both
      for (const el of allEls) {
        const text = (el.textContent || '').trim().toLowerCase();
        // Skip if this is the category label (contains "or rent" / "or sale")
        if (text.includes('or rent') || text.includes('or sale') || text.includes('หรือเช่า') || text.includes('หรือขาย')) continue;
        if (targets.some(t => text.includes(t.toLowerCase()) && text.includes('property'))) {
          return { found: true, alreadySelected: true, method: 'header-check' };
        }
      }

      // Debug: dump clickable elements near top of form
      const debugEls = [];
      for (const el of allEls) {
        const text = (el.textContent || '').trim();
        if (text.length > 2 && text.length < 40) {
          const rect = el.getBoundingClientRect();
          if (rect.y > 0 && rect.y < 400 && rect.width > 20) debugEls.push(text);
        }
      }
      return { found: false, debug: [...new Set(debugEls)].slice(0, 15) };
    }, targetTexts, oppositeTexts);

    if (tabResult.alreadySelected) {
      console.log(`    ✅ Listing type already correct`);
      return true;
    }
    if (tabResult.found) {
      console.log(`    📍 Found listing type tab via ${tabResult.method}: "${tabResult.text}"`);
      await page.mouse.click(tabResult.x, tabResult.y);
      await this.delay(2000); // Wait for form to reload with correct fields
      return true;
    }
    console.log(`    ⚠️ Listing type tab not found. Top elements: ${JSON.stringify(tabResult.debug)}`);

    // Strategy 4: Listing type might be a COMBOBOX (dropdown), not tabs
    // Try standard dropdown approach with common labels first
    const dropdownLabels = ['Choose listing type', 'Listing type', 'เลือกประเภทรายการ', 'ประเภทรายการ'];
    const dropdownOptions = isSale
      ? ['For sale', 'For Sale', 'สำหรับขาย', 'Sale']
      : ['For rent', 'For Rent', 'ให้เช่า', 'Rent'];
    const labelDropdown = await this.trySelectOnPage(page, dropdownLabels, dropdownOptions);
    if (labelDropdown) {
      console.log(`    ✅ Listing type set via labeled dropdown`);
      return true;
    }

    // Strategy 4.5: Click directly on "Choose listing type" text — it may be the dropdown trigger itself
    console.log(`    🔍 Strategy 4.5: Click on "Choose listing type" text directly...`);
    const directClickResult = await page.evaluate((labelTexts) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      const spans = scope.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text.length > 50) continue;
        const textLower = text.toLowerCase();
        for (const lbl of labelTexts) {
          if (textLower === lbl.toLowerCase() || textLower.includes(lbl.toLowerCase())) {
            // PRIORITY 1: Walk up parent tree to find a nearby combobox sibling (skip property type)
            let comboTarget = null;
            let p = span;
            for (let i = 0; i < 8; i++) {
              if (!p.parentElement) break;
              p = p.parentElement;
              if (p.getAttribute('role') === 'dialog') break;
              const combos = p.querySelectorAll('[role="combobox"]');
              for (const combo of combos) {
                if (combo === span) continue;
                const ct = (combo.textContent || '').trim().toLowerCase();
                if (/type of property|ประเภทอสังหาริมทรัพย์|ประเภทของอสังหาริมทรัพย์|house|flat|townhouse|บ้าน|อพาร์ท/i.test(ct)) continue;
                comboTarget = combo; break;
              }
              if (comboTarget) break;
            }
            // PRIORITY 2: closest combobox/haspopup ancestor (narrow selectors only)
            const clickTarget = comboTarget || span.closest('[role="combobox"], [aria-haspopup], [tabindex="0"]') || span;
            const rect = clickTarget.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.y > 0) {
              return {
                found: true,
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
                text,
                labelY: Math.round(rect.y),
                anchorY: Math.round(rect.y + rect.height),
                hitCombo: !!comboTarget
              };
            }
          }
        }
      }
      return { found: false };
    }, dropdownLabels);

    const anchorYFromDirect = directClickResult && directClickResult.found ? directClickResult.anchorY : null;

    if (directClickResult.found) {
      console.log(`    📍 Strategy 4.5: Clicking "${directClickResult.text}" at y=${directClickResult.labelY} hitCombo=${directClickResult.hitCombo || false}`);
      await page.mouse.click(directClickResult.x, directClickResult.y);
      await this.delay(1500);
      // Check if clicking opened a dropdown
      for (const opt of dropdownOptions) {
        const optClicked = await this._clickOptionInDropdown(page, opt);
        if (optClicked) {
          console.log(`    ✅ Listing type selected via direct click on label`);
          await this.delay(1800);
          return true;
        }
      }

      // If dropdown is keyboard-driven, try ArrowDown to open it
      await page.keyboard.press('ArrowDown');
      await this.delay(900);
      for (const opt of dropdownOptions) {
        const optClicked = await this._clickOptionInDropdown(page, opt);
        if (optClicked) {
          console.log(`    ✅ Listing type selected via direct click + ArrowDown`);
          await this.delay(1800);
          return true;
        }
      }

      await page.keyboard.press('Escape');
      await this.delay(300);
    }

    // Strategy 4.6: Proximity-based — find "Choose listing type" label position,
    // then find the nearest combobox below it within 600px
    console.log(`    🔍 Strategy 4.6: Proximity-based (600px range)...`);
    const proximityResult = await page.evaluate((labelTexts, anchorY) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;

      let labelY = typeof anchorY === 'number' && anchorY > 0 ? anchorY : -1;
      let labelText = typeof anchorY === 'number' && anchorY > 0 ? '(anchorY)' : '';

      if (labelY < 0) {
        const spans = scope.querySelectorAll('span');
        for (const span of spans) {
          const text = (span.textContent || '').trim();
          if (text.length > 50) continue;
          const textLower = text.toLowerCase();
          for (const lbl of labelTexts) {
            if (textLower === lbl.toLowerCase() || textLower.includes(lbl.toLowerCase())) {
              const rect = span.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.y > 0) {
                labelY = rect.y + rect.height;
                labelText = text;
                break;
              }
            }
          }
          if (labelY > 0) break;
        }
      }

      if (labelY < 0) return { found: false, debug: 'label not found' };

      // Find the first combobox below the label within 600px
      const combos = scope.querySelectorAll('[role="combobox"]');
      let bestCombo = null;
      let bestDist = 600;
      for (const cb of combos) {
        const rect = cb.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 10) continue;
        const cbText = (cb.textContent || '').trim().slice(0, 60).toLowerCase();
        // Skip property type combobox (already filled)
        if (cbText.includes('type of property') || cbText.includes('ประเภทอสังหาริมทรัพย์') || cbText.includes('house') || cbText.includes('flat') || cbText.includes('townhouse') || cbText.includes('บ้าน') || cbText.includes('อพาร์ท')) continue;
        // Skip utility comboboxes
        if (/washing|parking|air con|heating|เครื่องซัก|ที่จอดรถ|แอร์|เครื่องทำความร้อน/i.test(cbText)) continue;
        const dist = rect.y - labelY;
        if (dist >= -20 && dist < bestDist) {
          bestDist = dist;
          bestCombo = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: (cb.textContent || '').trim().slice(0, 60), comboY: Math.round(rect.y) };
        }
      }

      if (bestCombo) return { found: true, ...bestCombo, labelText, labelY: Math.round(labelY), method: 'proximity-combobox' };

      // Also look for aria-haspopup elements near the label (strict: dropdown triggers only, NOT generic buttons)
      const haspopups = scope.querySelectorAll('[aria-haspopup="true"], [aria-haspopup="listbox"], [aria-haspopup="menu"]');
      for (const el of haspopups) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 15) continue;
        const elText = (el.textContent || '').trim();
        if (elText.length > 30) continue; // listing type values are short
        const dist = rect.y - labelY;
        if (dist >= -20 && dist < 200 && dist < bestDist) {
          if (/^(next|post|publish|ถัดไป|โพสต์|add photo|เพิ่มรูป)/i.test(elText)) continue;
          bestDist = dist;
          bestCombo = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: elText.slice(0, 60), comboY: Math.round(rect.y) };
        }
      }

      if (bestCombo) return { found: true, ...bestCombo, labelText, labelY: Math.round(labelY), method: 'proximity-haspopup' };

      return { found: false, debug: `label "${labelText}" at y=${Math.round(labelY)} but no interactive element within 600px` };
    }, dropdownLabels, anchorYFromDirect);

    if (proximityResult.found) {
      console.log(`    📍 Found via ${proximityResult.method}: "${proximityResult.text}" at y=${proximityResult.comboY} (label="${proximityResult.labelText}" labelY=${proximityResult.labelY})`);
      await page.mouse.click(proximityResult.x, proximityResult.y);
      await this.delay(1500);
      for (const opt of dropdownOptions) {
        const optClicked = await this._clickOptionInDropdown(page, opt);
        if (optClicked) {
          console.log(`    ✅ Listing type selected via proximity`);
          await this.delay(1800);
          return true;
        }
      }
      // Try keyboard navigation: focus + ArrowDown to reveal options
      console.log(`    🔍 Trying keyboard navigation (ArrowDown)...`);
      await page.keyboard.press('ArrowDown');
      await this.delay(1000);
      for (const opt of dropdownOptions) {
        const optClicked = await this._clickOptionInDropdown(page, opt);
        if (optClicked) {
          console.log(`    ✅ Listing type selected via proximity+keyboard`);
          await this.delay(1800);
          return true;
        }
      }
      const availOpts = await this._getVisibleOptions(page);
      console.log(`    ⚠️ Proximity: no matching option. Available: ${JSON.stringify(availOpts)}`);
      await page.keyboard.press('Escape');
      await this.delay(400);
    } else {
      console.log(`    ⚠️ Proximity search: ${proximityResult.debug}`);
    }

    // Strategy 5: Try each EMPTY combobox — the first unfilled one after property type is likely listing type
    console.log(`    🔍 Strategy 5: Trying empty comboboxes (click + focus + ArrowDown)...`);

    const comboCandidates = await page.evaluate(() => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      const out = [];
      const combos = scope.querySelectorAll('[role="combobox"]');
      for (const cb of combos) {
        const rect = cb.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 10) continue;
        const text = (cb.textContent || '').trim().slice(0, 60);
        const isEmpty = text.length === 0 || text.length < 3;
        out.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, yTop: rect.y, text, isEmpty });
      }
      out.sort((a, b) => a.yTop - b.yTop);
      return out.slice(0, 12);
    });

    const saleMarkers = ['for sale', 'sale', 'สำหรับขาย', 'ขาย'];
    const rentMarkers = ['for rent', 'rent', 'ให้เช่า', 'เช่า'];

    // Try empty comboboxes FIRST (most likely to be listing type)
    const emptyFirst = [...comboCandidates].sort((a, b) => (a.isEmpty === b.isEmpty ? 0 : a.isEmpty ? -1 : 1));

    for (const cand of emptyFirst) {
      // Skip utility comboboxes
      const skipTexts = ['washing', 'parking', 'air con', 'heating', 'เครื่องซักผ้า', 'ที่จอดรถ', 'แอร์', 'เครื่องทำความร้อน', 'type of property', 'ประเภทอสังหาริมทรัพย์'];
      if (skipTexts.some(s => cand.text.toLowerCase().includes(s))) continue;
      // Skip property type (already has value like House/Flat/etc.)
      if (/house|flat|townhouse|room|บ้าน|อพาร์ท|ทาวน์/i.test(cand.text)) continue;

      console.log(`    📍 Combobox y=${Math.round(cand.yTop)} text="${cand.text}" empty=${cand.isEmpty}`);

      // Method A: mouse click
      await page.mouse.click(cand.x, cand.y);
      await this.delay(1500);

      let dropdownOpts = await this._getVisibleOptions(page);
      console.log(`    🔍 After click — options: ${JSON.stringify(dropdownOpts.slice(0, 15))}`);

      // If no options appeared, try focus + ArrowDown
      if (dropdownOpts.length === 0) {
        console.log(`    🔍 No options from click, trying focus+ArrowDown...`);
        await page.keyboard.press('ArrowDown');
        await this.delay(1000);
        dropdownOpts = await this._getVisibleOptions(page);
        console.log(`    🔍 After ArrowDown — options: ${JSON.stringify(dropdownOpts.slice(0, 15))}`);
      }

      // If still no options, try typing to trigger autocomplete
      if (dropdownOpts.length === 0 && cand.isEmpty) {
        console.log(`    🔍 No options, trying type trigger...`);
        await page.keyboard.type('F', { delay: 50 });
        await this.delay(1000);
        dropdownOpts = await this._getVisibleOptions(page);
        console.log(`    🔍 After typing "F" — options: ${JSON.stringify(dropdownOpts.slice(0, 15))}`);
        // Clear what we typed
        await page.keyboard.press('Backspace');
        await this.delay(300);
      }

      const signature = dropdownOpts.map(t => t.toLowerCase());
      const hasSale = signature.some(t => saleMarkers.some(m => t.includes(m)));
      const hasRent = signature.some(t => rentMarkers.some(m => t.includes(m)));

      if (hasSale || hasRent) {
        console.log(`    ✅ Listing type dropdown detected! (sale=${hasSale}, rent=${hasRent})`);
        for (const opt of dropdownOptions) {
          const optClicked = await this._clickOptionInDropdown(page, opt);
          if (optClicked) {
            console.log(`    ✅ Listing type selected via combobox scan`);
            await this.delay(1800);
            return true;
          }
        }
        console.log(`    ⚠️ Detected but could not click option. Options: ${JSON.stringify(dropdownOpts.slice(0, 15))}`);
      }

      await page.keyboard.press('Escape');
      await this.delay(400);
    }

    // Strategy 6: DOM debug dump — show what's near "Choose listing type" so we can fix
    const domDump = await page.evaluate((labelTexts) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      const scopeKind = _fd ? 'dialog' : (document.querySelector('[role="main"]') ? 'main' : 'document');

      // Find the "Choose listing type" span
      let targetSpan = null;
      const spans = scope.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text.length > 50) continue;
        for (const lbl of labelTexts) {
          if (text.toLowerCase().includes(lbl.toLowerCase())) {
            targetSpan = span;
            break;
          }
        }
        if (targetSpan) break;
      }
      if (!targetSpan) {
        // Provide top-of-scope debug so we can see what's rendered
        const topTexts = [];
        for (const el of scope.querySelectorAll('span, label, [role="button"], [role="tab"], [role="radio"]')) {
          const t = (el.textContent || '').trim();
          if (t.length > 2 && t.length < 40) topTexts.push(t);
          if (topTexts.length > 30) break;
        }
        return { debug: 'label span not found', scopeKind, topTexts: [...new Set(topTexts)].slice(0, 25) };
      }

      // Walk up to find the container section
      const ancestors = [];
      let el = targetSpan;
      for (let i = 0; i < 8; i++) {
        if (!el.parentElement) break;
        el = el.parentElement;
        const tag = el.tagName;
        const role = el.getAttribute('role') || '';
        const cls = (el.className || '').toString().slice(0, 40);
        ancestors.push(`${tag}[role=${role}][class=${cls}]`);
      }

      // Look at siblings of each ancestor level
      const nearbyElements = [];
      el = targetSpan;
      for (let i = 0; i < 6; i++) {
        if (!el.parentElement) break;
        el = el.parentElement;
        const children = el.children;
        for (const child of children) {
          const rect = child.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 5) continue;
          const tag = child.tagName;
          const role = child.getAttribute('role') || '';
          const text = (child.textContent || '').trim().slice(0, 50);
          const ariaLabel = child.getAttribute('aria-label') || '';
          nearbyElements.push({ tag, role, text: text.length > 40 ? text.slice(0, 40) + '...' : text, ariaLabel, y: Math.round(rect.y), h: Math.round(rect.height) });
        }
        if (nearbyElements.length > 10) break;
      }

      return { ancestors, nearbyElements: nearbyElements.slice(0, 20), scopeKind };
    }, dropdownLabels);
    console.log(`    📋 DOM near "Choose listing type":`);
    console.log(`    📋 Ancestors: ${JSON.stringify(domDump.ancestors || [])}`);
    console.log(`    📋 Nearby: ${JSON.stringify(domDump.nearbyElements || domDump.topTexts || domDump.debug || [])}`);

    // Final fallback: check if property type dropdown label already contains the correct mode
    const modeCheck = await page.evaluate((targets, opposites) => {
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) {
        if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
        _fd = _d; break;
      }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      // Check all comboboxes and labels for "for sale" / "for rent" in their text
      const allText = (scope.textContent || '').toLowerCase();
      const hasTarget = targets.some(t => allText.includes(t.toLowerCase()));
      const hasOpposite = opposites.some(t => allText.includes(t.toLowerCase()));
      // Check property type dropdown specifically
      const combos = scope.querySelectorAll('[role="combobox"]');
      for (const cb of combos) {
        const ct = (cb.textContent || '').trim();
        if (/type of property|ประเภท.*อสังหาริมทรัพย์/i.test(ct)) {
          const ctl = ct.toLowerCase();
          const matchTarget = targets.some(t => ctl.includes(t.toLowerCase()));
          const matchOpp = opposites.some(t => ctl.includes(t.toLowerCase()));
          if (matchTarget && !matchOpp) return { ok: true, reason: `property type label says "${ct}"` };
          if (matchOpp && !matchTarget) return { ok: false, reason: `property type label says "${ct}" (wrong mode)` };
        }
      }
      return { ok: false, reason: 'no mode indicator found' };
    }, targetTexts, oppositeTexts);

    if (modeCheck.ok) {
      console.log(`    ✅ Listing type confirmed via fallback: ${modeCheck.reason}`);
      return true;
    }
    console.log(`    ⚠️ Fallback mode check: ${modeCheck.reason}`);

    console.log(`    ❌ All listing type strategies exhausted — could not set listing type`);
    return false;
  }

  // Helper: get visible dropdown options currently on page
  async _getVisibleOptions(page) {
    return page.evaluate(() => {
      const selectors = '[role="option"], [role="menuitem"], [role="listbox"] [role="option"], [role="menu"] [role="menuitem"], [role="listbox"] > div, ul[role="listbox"] > li';
      const texts = [];
      for (const n of document.querySelectorAll(selectors)) {
        const t = (n.textContent || '').trim();
        if (t.length > 0 && t.length < 60) texts.push(t);
      }
      return [...new Set(texts)].slice(0, 25);
    });
  }

  // Helper: click an option in a currently open dropdown
  async _clickOptionInDropdown(page, optionText) {
    const optResult = await page.evaluate((optText) => {
      const optLower = optText.toLowerCase();
      // Broad selectors for dropdown options
      const selectors = '[role="option"], [role="listbox"] [role="option"], [role="menu"] [role="menuitem"], [role="menuitem"]';
      const options = document.querySelectorAll(selectors);
      // Pass 1: exact or includes match
      for (const o of options) {
        const t = (o.textContent || '').trim();
        const tl = t.toLowerCase();
        if (tl === optLower || tl.includes(optLower) || optLower.includes(tl)) {
          const rect = o.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: t };
        }
      }
      // Pass 2: broader search — any visible leaf span/div matching the text
      for (const el of document.querySelectorAll('span, div')) {
        if (el.children.length > 1) continue;
        const t = (el.textContent || '').trim();
        const tl = t.toLowerCase();
        if (t.length > 30 || t.length < 2) continue;
        if (tl === optLower || tl.includes(optLower) || optLower.includes(tl)) {
          // Must be in a popup/overlay context (not the main form)
          const inPopup = el.closest('[role="listbox"], [role="menu"], [data-visualcompletion="ignore-dynamic"]');
          if (!inPopup) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: t };
        }
      }
      return { found: false };
    }, optionText);

    if (optResult.found) {
      console.log(`    📍 Selecting option "${optResult.text}"...`);
      await page.mouse.click(optResult.x, optResult.y);
      return true;
    }
    return false;
  }

  // Try multiple labels for nativeTypeOnPage — returns true if any label worked
  async tryTypeOnPage(page, labels, value, { alsoTryDropdown = false } = {}) {
    for (const label of labels) {
      const typed = await this.nativeTypeOnPage(page, label, value);
      if (typed) return true;
    }
    // nativeTypeOnPage already has aria-label/placeholder search built in (PRIORITY 3)
    // So if we get here, no input was found at all

    // If alsoTryDropdown, try selecting from a dropdown (for bedrooms/bathrooms)
    if (alsoTryDropdown) {
      console.log(`    🔽 Trying as dropdown instead...`);
      const selectResult = await this.trySelectOnPage(page, labels, [String(value)]);
      if (selectResult) return true;
    }
    console.log(`    ⚠️ None of labels found or no input: ${JSON.stringify(labels)}`);
    return false;
  }

  // Try multiple labels for nativeSelectDropdownOnPage
  async trySelectOnPage(page, labels, optionValues) {
    const opts = Array.isArray(optionValues) ? optionValues : [optionValues];
    for (const label of labels) {
      for (const opt of opts) {
        const ok = await this.nativeSelectDropdownOnPage(page, label, opt);
        if (ok) return true;
      }
    }
    console.log(`    ⚠️ None of dropdown labels found or could not select: ${JSON.stringify(labels)}`);
    return false;
  }

  // Try multiple labels for nativeTypeTextareaOnPage
  async tryTypeTextareaOnPage(page, labels, value) {
    for (const label of labels) {
      const ok = await this.nativeTypeTextareaOnPage(page, label, value);
      if (ok) return true;
    }
    // Fallback: no span label found, but nativeTypeTextareaOnPage has its own
    // textarea/textbox finder — always try it
    console.log(`    ⚠️ None of textarea labels found: ${JSON.stringify(labels)} — trying textarea fallback...`);
    const ok = await this.nativeTypeTextareaOnPage(page, labels[0] || 'Description', value);
    return !!ok;
  }

  // Scroll within the dialog (NOT window) — prevents closing the dialog
  async scrollDownInDialog(page, amount = 300) {
    await page.evaluate((scrollAmount) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      let didScroll = false;
      for (const d of dialogs) {
        // Skip Notifications dialog
        if (/(notification|unread|การแจ้งเตือน)/i.test((d.textContent || '').slice(0, 500))) continue;
        const divs = d.querySelectorAll('div');
        for (const el of divs) {
          if (el.scrollHeight > el.clientHeight + 50) {
            el.scrollBy(0, scrollAmount);
            didScroll = true;
            return;
          }
        }
      }
      if (!didScroll) window.scrollBy(0, scrollAmount);
    }, amount);
    await this.delay(400);
  }

  async scrollToLabelOnPage(page, labelText) {
    await page.evaluate((label) => {
      // Search within form dialog only (skip Notifications)
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const spans = (_fd || document).querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text !== label && !text.includes(label)) continue;
        // SKIP headings/titles — they are in the dialog header, not the form body
        if (span.closest('h1, h2, h3, h4, [role="heading"]')) continue;
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }, labelText);
    await this.delay(500);
  }

  async nativeTypeOnPage(page, labelText, value) {
    if (!value && value !== 0) return false;
    const val = String(value);
    console.log(`  ⌨️ Typing "${val}" into "${labelText}"...`);
    await this.scrollToLabelOnPage(page, labelText);

    const inputBox = await page.evaluate((label) => {
      // Search within form dialog only (skip Notifications)
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;

      // Broad input selector: match text, number, tel, and untyped inputs + spinbutton
      const INPUT_SEL = 'input[type="text"], input[type="number"], input[type="tel"], input:not([type]), [role="spinbutton"]';

      const spans = scope.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text !== label && !text.includes(label)) continue;
        // SKIP headings/titles
        if (span.closest('h1, h2, h3, h4, [role="heading"]')) continue;

        // PRIORITY 1: label > input (any type)
        const labelEl = span.closest('label');
        if (labelEl) {
          const input = labelEl.querySelector(INPUT_SEL);
          if (input && input.type !== 'hidden' && input.type !== 'file' && input.type !== 'checkbox' && input.type !== 'radio') {
            input.scrollIntoView({ block: 'center' });
            const rect = input.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 0)
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'label-input' };
          }
        }

        // PRIORITY 2: Walk up parents to find ANY visible input
        let parent = span.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!parent) break;
          if (parent.getAttribute('role') === 'heading' || parent.getAttribute('role') === 'dialog') break;
          const input = parent.querySelector(INPUT_SEL);
          if (input && input.type !== 'hidden' && input.type !== 'file' && input.type !== 'checkbox' && input.type !== 'radio') {
            input.scrollIntoView({ block: 'center' });
            const rect = input.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 0)
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'parent-input' };
          }
          parent = parent.parentElement;
        }
      }

      // PRIORITY 3: Search ALL inputs by aria-label/placeholder containing label
      const lbl = label.toLowerCase();
      for (const inp of scope.querySelectorAll(INPUT_SEL)) {
        if (inp.type === 'hidden' || inp.type === 'file' || inp.type === 'checkbox' || inp.type === 'radio') continue;
        const ph = (inp.placeholder || '').toLowerCase();
        const al = (inp.getAttribute('aria-label') || '').toLowerCase();
        if (ph.includes(lbl) || al.includes(lbl)) {
          inp.scrollIntoView({ block: 'center' });
          const rect = inp.getBoundingClientRect();
          if (rect.width > 10 && rect.height > 0)
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'aria-match' };
        }
      }
      return { found: false, reason: 'no-input-near-label' };
    }, labelText);

    if (!inputBox.found) {
      console.log(`    ⚠️ Input "${labelText}" not found (${inputBox.reason})`);
      return false;
    }
    console.log(`    📍 Found via ${inputBox.method}`);
    await page.mouse.click(inputBox.x, inputBox.y);
    await this.delay(300);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await this.delay(200);
    await page.keyboard.type(val, { delay: 30 + Math.random() * 20 });
    console.log(`    ✅ Done`);
    return true;
  }

  async nativeSelectDropdownOnPage(page, labelText, optionValue) {
    if (!optionValue) return false;
    console.log(`  🔽 Selecting "${optionValue}" in dropdown "${labelText}"...`);
    await this.scrollToLabelOnPage(page, labelText);

    const dropdownBox = await page.evaluate((label) => {
      // Search within form dialog only (skip Notifications)
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;
      const spans = scope.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text !== label && !text.includes(label)) continue;

        // CRITICAL: Skip spans in headings/titles — these are the dialog header, NOT the form!
        if (span.closest('h1, h2, h3, h4, [role="heading"]')) continue;

        // PRIORITY 1: Find [role="combobox"] ancestor (most reliable)
        const combobox = span.closest('[role="combobox"]');
        if (combobox) {
          const rect = combobox.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'combobox' };
          }
        }

        // PRIORITY 2: Find sibling/nearby combobox within same label/container
        let parent = span;
        for (let i = 0; i < 5; i++) {
          if (!parent.parentElement) break;
          parent = parent.parentElement;
          // Don't walk up past a heading or the dialog itself
          if (parent.getAttribute('role') === 'heading' || parent.getAttribute('role') === 'dialog') break;
          const combo = parent.querySelector('[role="combobox"]');
          if (combo) {
            const rect = combo.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'sibling-combo' };
            }
          }
        }

        // PRIORITY 3: Find a label > select/input sibling
        const labelEl = span.closest('label');
        if (labelEl) {
          const select = labelEl.querySelector('select, [role="combobox"], [role="listbox"]');
          if (select) {
            const rect = select.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'label-select' };
            }
          }
        }

        // NO FALLBACK — do NOT click random elements, it closes the dialog!
      }
      return { found: false };
    }, labelText);

    if (!dropdownBox.found) {
      console.log(`    ⚠️ Dropdown "${labelText}" not found — skipping safely`);
      return false;
    }
    console.log(`    📍 Found dropdown via ${dropdownBox.method} at (${Math.round(dropdownBox.x)}, ${Math.round(dropdownBox.y)})`);
    await page.mouse.click(dropdownBox.x, dropdownBox.y);
    await this.delay(1000);

    const optionBox = await page.evaluate((val) => {
      const valLower = val.toLowerCase();
      const selectors = '[role="option"], [role="menuitem"], [role="listbox"] [role="option"]';
      let options = document.querySelectorAll(selectors);
      if (options.length === 0) {
        options = document.querySelectorAll('[role="listbox"] div, [role="menu"] div');
      }
      // Pass 1: exact or includes match
      for (const option of options) {
        const text = (option.textContent || '').trim();
        if (text === val || text.includes(val)) {
          const rect = option.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
      }
      // Pass 2: case-insensitive partial match
      for (const option of options) {
        const text = (option.textContent || '').trim().toLowerCase();
        if (text === valLower || text.includes(valLower) || valLower.includes(text)) {
          const rect = option.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
      }
      // Broader search: leaf elements with exact text
      const allEls = document.querySelectorAll('span, div');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = (el.textContent || '').trim();
        if (text === val || text.toLowerCase() === valLower) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.y > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
      }
      return { found: false };
    }, optionValue);

    if (optionBox.found) {
      await page.mouse.click(optionBox.x, optionBox.y);
      console.log(`    ✅ Selected "${optionValue}"`);
      await this.delay(800);

      const verify = await page.evaluate((label, val) => {
        const _ds = document.querySelectorAll('[role="dialog"]');
        let _fd = null;
        for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
        const scope = _fd || document.querySelector('[role="main"]') || document;
        const spans = scope.querySelectorAll('span');
        let targetSpan = null;
        for (const span of spans) {
          const t = (span.textContent || '').trim();
          if (t === label || t.includes(label)) { targetSpan = span; break; }
        }
        if (!targetSpan) return { ok: true };
        const combo = targetSpan.closest('[role="combobox"]') || targetSpan.parentElement?.querySelector?.('[role="combobox"]') || targetSpan.closest('label')?.querySelector?.('[role="combobox"], select');
        if (!combo) return { ok: true };
        const comboText = (combo.textContent || '').trim().toLowerCase();
        const v = String(val || '').trim().toLowerCase();
        return { ok: v ? comboText.includes(v) : true, comboText: comboText.slice(0, 60) };
      }, labelText, optionValue);

      if (!verify.ok) {
        console.log(`    ⚠️ Dropdown verify failed (comboText="${verify.comboText || ''}")`);
        return false;
      }
      return true;
    } else {
      // Debug: show what options ARE available
      const availableOpts = await page.evaluate(() => {
        const opts = document.querySelectorAll('[role="option"], [role="menuitem"]');
        const texts = [];
        for (const o of opts) { const t = (o.textContent || '').trim(); if (t.length > 0 && t.length < 50) texts.push(t); }
        return [...new Set(texts)].slice(0, 15);
      });
      console.log(`    ⚠️ Option "${optionValue}" not found. Available: ${JSON.stringify(availableOpts)}`);
      // Safe way to dismiss dropdown: press Escape then scroll
      await page.keyboard.press('Escape');
      await this.delay(300);
      await this.scrollDownInDialog(page, 50);
      return false;
    }
    await this.delay(500);
  }

  async nativeTypeTextareaOnPage(page, labelText, value) {
    if (!value) return false;
    console.log(`  📝 Typing description...`);
    await this.scrollDownInDialog(page, 300);
    await this.delay(500);

    const labelVariants = [labelText, 'คำอธิบาย', 'คำอธิบายอสังหาริมทรัพย์', 'คำอธิบายของที่พักให้เช่า', 'Description', 'description'];
    const textareaBox = await page.evaluate((labels) => {
      // Find form dialog (skip Notifications)
      const _ds = document.querySelectorAll('[role="dialog"]');
      let _fd = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
      const scope = _fd || document.querySelector('[role="main"]') || document;

      // Method 1: Find by span label near a textarea
      for (const label of labels) {
        const spans = scope.querySelectorAll('span');
        for (const span of spans) {
          const text = (span.textContent || '').trim();
          if (!text.includes(label)) continue;
          if (span.closest('h1, h2, h3, h4, [role="heading"]')) continue;
          const labelEl = span.closest('label');
          if (labelEl) {
            const ta = labelEl.querySelector('textarea');
            if (ta) { ta.scrollIntoView({ block: 'center' }); const rect = ta.getBoundingClientRect(); if (rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'span-label' }; }
          }
          let parent = span.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!parent) break;
            if (parent.getAttribute('role') === 'heading' || parent.getAttribute('role') === 'dialog') break;
            const ta = parent.querySelector('textarea');
            if (ta) { ta.scrollIntoView({ block: 'center' }); const rect = ta.getBoundingClientRect(); if (rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'span-parent' }; }
            parent = parent.parentElement;
          }
        }
      }

      // Method 2: Search textarea by placeholder/aria-label
      const descKws = ['description', 'คำอธิบาย', 'describe', 'details'];
      const allTa = scope.querySelectorAll('textarea');
      for (const ta of allTa) {
        const ph = (ta.placeholder || '').toLowerCase();
        const al = (ta.getAttribute('aria-label') || '').toLowerCase();
        if (descKws.some(kw => ph.includes(kw) || al.includes(kw))) {
          ta.scrollIntoView({ block: 'center' }); const r = ta.getBoundingClientRect();
          if (r.width > 50 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'textarea-placeholder' };
        }
      }

      // Method 3: Search div[role="textbox"] (Facebook sometimes uses this)
      const textboxes = scope.querySelectorAll('div[role="textbox"], div[contenteditable="true"]');
      for (const tb of textboxes) {
        const ph = (tb.getAttribute('aria-label') || '').toLowerCase();
        const placeholder = (tb.getAttribute('placeholder') || tb.dataset?.placeholder || '').toLowerCase();
        if (descKws.some(kw => ph.includes(kw) || placeholder.includes(kw))) {
          tb.scrollIntoView({ block: 'center' }); const r = tb.getBoundingClientRect();
          if (r.width > 50 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'textbox-aria' };
        }
      }

      // Method 4: Fallback — any textarea in dialog (not the title/price ones)
      for (const ta of allTa) {
        const rect = ta.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 30 && rect.y > 0) {
          ta.scrollIntoView({ block: 'center' }); const r = ta.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'any-textarea' };
        }
      }

      // Method 5: Fallback — any large textbox div
      for (const tb of textboxes) {
        const rect = tb.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 20 && rect.y > 0) {
          tb.scrollIntoView({ block: 'center' }); const r = tb.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'any-textbox' };
        }
      }

      // Debug: report what we found
      const debugInfo = { textareas: allTa.length, textboxes: textboxes.length };
      return { found: false, debug: JSON.stringify(debugInfo) };
    }, labelVariants);

    if (!textareaBox.found) { console.log(`    ⚠️ Textarea not found. Debug: ${textareaBox.debug || 'none'}`); return false; }
    console.log(`    📝 Found textarea via ${textareaBox.method}`);
    await page.mouse.click(textareaBox.x, textareaBox.y);
    await this.delay(500);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await this.delay(200);
    await page.keyboard.type(value, { delay: 15 + Math.random() * 10 });
    console.log(`    ✅ Description typed (${value.length} chars)`);
    return true;
  }

  async nativeFillLocationOnPage(page, location) {
    if (!location) return false;
    console.log(`  📍 Filling location: "${location}"...`);
    // Scroll down aggressively to ensure location field is rendered
    for (let i = 0; i < 3; i++) {
      await this.scrollDownInDialog(page, 300);
      await this.delay(500);
    }

    const locationBox = await page.evaluate(() => {
      // Search within dialog only
      // Find form dialog (skip Notifications)
      const _ds = document.querySelectorAll('[role="dialog"]');
      let dialog = null;
      for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; dialog = _d; break; }
      const scope = dialog || document.querySelector('[role="main"]') || document;

      // Method 1: label with SVG icon + input
      const labels = scope.querySelectorAll('label');
      for (const label of labels) {
        const svg = label.querySelector('svg');
        const input = label.querySelector('input[role="combobox"], input[type="text"], input:not([type])');
        if (svg && input) {
          const rect = input.getBoundingClientRect();
          if (rect.y > 150 && rect.width > 50 && rect.height > 0) {
            input.scrollIntoView({ block: 'center' });
            const r = input.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'svg-label' };
          }
        }
      }

      // Method 2: input with placeholder/aria-label containing location keywords
      const locationKws = ['location', 'ตำแหน่ง', 'สถานที่', 'city', 'address', 'where'];
      const allInputs = scope.querySelectorAll('input');
      for (const input of allInputs) {
        const ph = (input.placeholder || '').toLowerCase();
        const al = (input.getAttribute('aria-label') || '').toLowerCase();
        const combined = ph + ' ' + al;
        if (locationKws.some(kw => combined.includes(kw))) {
          input.scrollIntoView({ block: 'center' });
          const r = input.getBoundingClientRect();
          if (r.width > 50 && r.height > 0) {
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'placeholder' };
          }
        }
      }

      // Method 3: span with location text near a combobox
      const spans = scope.querySelectorAll('span');
      for (const span of spans) {
        const text = (span.textContent || '').trim().toLowerCase();
        if (!locationKws.some(kw => text.includes(kw))) continue;
        let parent = span;
        for (let i = 0; i < 8; i++) {
          if (!parent.parentElement) break;
          parent = parent.parentElement;
          if (parent.getAttribute('role') === 'dialog') break;
          const input = parent.querySelector('input[role="combobox"], input[type="text"], input:not([type])');
          if (input) {
            input.scrollIntoView({ block: 'center' });
            const r = input.getBoundingClientRect();
            if (r.width > 50 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'span-near' };
          }
        }
      }

      // Method 4: empty combobox (last resort)
      const combos = scope.querySelectorAll('input[role="combobox"]');
      for (const input of combos) {
        const rect = input.getBoundingClientRect();
        if (rect.y < 150) continue;
        if (!input.value && rect.width > 50 && rect.height > 0) {
          input.scrollIntoView({ block: 'center' });
          const r = input.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true, method: 'empty-combo' };
        }
      }

      // Debug info
      const debugInputs = [];
      scope.querySelectorAll('input').forEach(inp => {
        debugInputs.push({ type: inp.type, placeholder: inp.placeholder, ariaLabel: inp.getAttribute('aria-label'), role: inp.getAttribute('role') });
      });
      return { found: false, debug: JSON.stringify(debugInputs.slice(0, 10)) };
    });

    if (!locationBox.found) {
      console.log(`    ⚠️ Location input not found. Debug: ${locationBox.debug || 'none'}`);
      return false;
    }
    console.log(`    📍 Location found via ${locationBox.method}`);

    const parts = location.split(' ').filter(Boolean);
    const searchTerms = parts.length >= 2 ? [parts[parts.length - 1], location] : [location];

    for (const searchTerm of searchTerms) {
      console.log(`    🔍 Trying: "${searchTerm}"...`);
      await page.mouse.click(locationBox.x, locationBox.y);
      await this.delay(300);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await this.delay(300);
      await page.keyboard.type(searchTerm, { delay: 80 + Math.random() * 40 });
      await this.delay(3000);

      const suggestionClicked = await page.evaluate((search) => {
        const options = document.querySelectorAll('[role="option"]');
        if (options.length > 0) {
          for (const opt of options) {
            const text = (opt.textContent || '').trim();
            if (text.includes(search)) {
              const rect = opt.getBoundingClientRect();
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
            }
          }
          const first = options[0];
          const rect = first.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
        return { found: false };
      }, searchTerm);

      if (suggestionClicked.found) {
        await page.mouse.click(suggestionClicked.x, suggestionClicked.y);
        console.log(`    ✅ Location selected`);
        await this.delay(1000);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await this.delay(300);
        return true;
      }
    }
    // Fallback: ArrowDown + Enter (NO Tab — Tab could exit the dialog)
    await page.keyboard.press('ArrowDown');
    await this.delay(500);
    await page.keyboard.press('Enter');
    await this.delay(500);
    // Click away from input to deselect (safe, stays in dialog)
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await this.delay(300);
    return true;
  }

  // Upload images on the buy/sell listing form (uses file input, not composer)
  async uploadImagesOnBuySellForm(page, filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    console.log(`📷 Uploading ${filePaths.length} images to buy/sell form...`);
    try {
      const fileInputSelector = 'input[type="file"]';
      await page.waitForSelector(fileInputSelector, { timeout: 10000 });
      const fileInputs = await page.$$(fileInputSelector);
      let uploaded = false;
      for (const fi of fileInputs) {
        try {
          await fi.uploadFile(...filePaths);
          uploaded = true;
          console.log(`✅ ${filePaths.length} images uploaded`);
          break;
        } catch (e) { continue; }
      }
      if (!uploaded) {
        // Fallback: click "เพิ่มรูปภาพ" area then upload
        const addPhotoBox = await page.evaluate(() => {
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
          await page.mouse.click(addPhotoBox.x, addPhotoBox.y);
          await this.delay(1000);
          const fi = await page.$(fileInputSelector);
          if (fi) await fi.uploadFile(...filePaths);
        }
      }
      await this.delay(2000 + filePaths.length * 500);
    } catch (error) {
      console.error('⚠️ Image upload error:', error.message);
    }
  }

  // ============================================
  // MAIN: Post to Buy/Sell group via "ขายสินค้า" → "บ้านสำหรับขายหรือเช่า" flow
  // ============================================
  async postBuySellListing(page, property, caption, preparedFilePaths = [], task = null) {
    console.log('\n🛒 Starting Buy/Sell group listing flow...');
    const updateMsg = (msg) => { if (task) task.message = msg; };

    try {
      // Step 1: Click "ขายสินค้า" button — MUST use native mouse click
      updateMsg('กดปุ่มขายสินค้า...');
      console.log('📌 Clicking "ขายสินค้า"...');
      const sellBtnBox = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"]');
        const sellKeywords = ['ขายสินค้า', 'sell something', 'sell', 'create listing', 'สร้างรายการ', 'list item'];
        const debugTexts = [];
        for (const btn of btns) {
          const label = (btn.getAttribute('aria-label') || '').trim();
          const text = (btn.textContent || '').trim();
          const lower = (label + ' ' + text).toLowerCase();
          if (text.length > 1 && text.length < 30) debugTexts.push(text);
          if (sellKeywords.some(kw => lower.includes(kw))) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text };
            }
          }
        }
        return { found: false, debugTexts: [...new Set(debugTexts)].slice(0, 15) };
      });

      if (sellBtnBox.found) {
        console.log(`   📍 Found sell button: "${sellBtnBox.text}"`);
      } else {
        console.log(`   🔍 Buttons on page:`, JSON.stringify(sellBtnBox.debugTexts));
        return { success: false, error: 'ไม่พบปุ่มขายสินค้า' };
      }
      await page.mouse.click(sellBtnBox.x, sellBtnBox.y);
      await this.delay(3000);

      // ── Verify the dialog is CATEGORY dialog, not Notifications ──
      const getDialogType = () => page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          const text = (d.textContent || '').toLowerCase();
          if (text.includes('notification') || text.includes('unread') || text.includes('push notification') || text.includes('การแจ้งเตือน')) continue;
          // This dialog is NOT notifications — it's the category/form dialog
          return 'category';
        }
        // Check if ANY dialog exists
        if (dialogs.length > 0) return 'notifications';
        return 'none';
      });

      for (let verifyAttempt = 0; verifyAttempt < 3; verifyAttempt++) {
        const dialogType = await getDialogType();
        console.log(`   🔍 Dialog type: ${dialogType}`);
        if (dialogType === 'category') break;
        if (dialogType === 'notifications') {
          console.log(`   ⚠️ Notifications still blocking! Reloading page...`);
          await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
          await this.delay(3000);
          // Re-find and re-click sell button after reload
          console.log(`   🔄 Re-finding sell button after reload...`);
          const newSellBtn = await page.evaluate(() => {
            const btns = document.querySelectorAll('[role="button"]');
            const kws = ['sell something', 'ขายสินค้า', 'sell', 'create listing'];
            for (const btn of btns) {
              const lower = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).toLowerCase();
              if (kws.some(kw => lower.includes(kw))) {
                const r = btn.getBoundingClientRect();
                if (r.width > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
              }
            }
            return { found: false };
          });
          if (newSellBtn.found) {
            await page.mouse.click(newSellBtn.x, newSellBtn.y);
            console.log(`   📍 Re-clicked sell button`);
            await this.delay(3000);
          }
        } else if (dialogType === 'none') {
          console.log(`   ⚠️ No dialog — re-clicking sell button...`);
          await page.mouse.click(sellBtnBox.x, sellBtnBox.y);
          await this.delay(3000);
        }
      }

      // Step 2: Dialog "สร้างรายการสินค้าใหม่" → Click "บ้านสำหรับขายหรือเช่า"
      // MUST use native mouse click — Facebook React ignores JS .click()
      updateMsg('เลือกประเภท บ้านสำหรับขายหรือเช่า...');
      console.log('📌 Selecting "บ้านสำหรับขายหรือเช่า" category...');
      // IMPORTANT: Do NOT use generic words like "Property" — they match group names!
      const keywords = [
        'บ้านสำหรับขายหรือเช่า', 'บ้านสำหรับขาย',
        'Home for Sale', 'Homes for Sale or Rent', 'Home for sale or rent',
        'Property for Sale or Rent',
      ];

      let cardClicked = false;
      for (let attempt = 0; attempt < 5 && !cardClicked; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry ${attempt + 1}/5...`);
          await this.delay(2000);
        }

        // Debug: log categories from the CORRECT (non-Notifications) dialog
        const allCategories = await page.evaluate(() => {
          const dialogs = document.querySelectorAll('[role="dialog"]');
          for (const dialog of dialogs) {
            const dText = (dialog.textContent || '').toLowerCase();
            // Skip Notifications dialog
            if (dText.includes('notification') || dText.includes('unread') || dText.includes('การแจ้งเตือน')) continue;
            const spans = dialog.querySelectorAll('span');
            const texts = [];
            for (const s of spans) {
              const t = (s.textContent || '').trim();
              if (t.length > 2 && t.length < 60) texts.push(t);
            }
            return { dialogFound: true, texts: [...new Set(texts)].slice(0, 25) };
          }
          return { dialogFound: false, texts: [] };
        });
        console.log(`   🔍 Category dialog found: ${allCategories.dialogFound}, items:`, JSON.stringify(allCategories.texts));

        // Search ONLY in non-Notifications dialogs
        const cardBox = await page.evaluate((kws) => {
          const dialogs = document.querySelectorAll('[role="dialog"]');
          for (const dialog of dialogs) {
            const dText = (dialog.textContent || '').toLowerCase();
            if (dText.includes('notification') || dText.includes('unread') || dText.includes('การแจ้งเตือน')) continue;
            const spans = dialog.querySelectorAll('span');
            for (const span of spans) {
              const text = (span.textContent || '').trim();
              const lower = text.toLowerCase();
              if (!kws.some(kw => text === kw || text.includes(kw) || lower.includes(kw.toLowerCase()))) continue;
              // Walk up to find card container with icon
              let card = span;
              for (let i = 0; i < 15; i++) {
                if (!card.parentElement) break;
                card = card.parentElement;
                // Don't walk outside the dialog
                if (card.getAttribute('role') === 'dialog') break;
                const hasIcon = card.querySelector('i[data-visualcompletion="css-img"]');
                if (hasIcon || card.getAttribute('role') === 'button') {
                  const rect = card.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'card', matchedText: text };
                  }
                }
              }
              // Fallback: use span position
              const rect = span.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'span', matchedText: text };
              }
            }
          }
          return { found: false };
        }, keywords);

        if (cardBox.found) {
          console.log(`   📍 Found "${cardBox.matchedText}" via ${cardBox.method} at (${Math.round(cardBox.x)}, ${Math.round(cardBox.y)})`);
          await page.mouse.click(cardBox.x, cardBox.y);
          cardClicked = true;
        }
      }

      if (!cardClicked) {
        return { success: false, error: 'ไม่พบปุ่ม "บ้านสำหรับขายหรือเช่า"' };
      }
      await this.delay(3000);

      // Step 2.5: Facebook may show a sub-selection "For sale" / "For rent" after clicking "Property for sale or rent"
      // We must click the correct one BEFORE the form fields appear
      const isSaleType = (property.listingType || 'sale') !== 'rent';
      const subTargets = isSaleType
        ? ['For sale', 'สำหรับขาย', 'Property for sale', 'บ้านสำหรับขาย']
        : ['For rent', 'ให้เช่า', 'Property for rent', 'บ้านให้เช่า'];
      const subOpposites = isSaleType
        ? ['For rent', 'ให้เช่า', 'Property for rent']
        : ['For sale', 'สำหรับขาย', 'Property for sale'];

      console.log(`📌 Step 2.5: Looking for "${isSaleType ? 'For sale' : 'For rent'}" sub-category...`);

      // Scan dialog for sub-category cards/buttons with "For sale" / "For rent"
      for (let subAttempt = 0; subAttempt < 3; subAttempt++) {
        if (subAttempt > 0) await this.delay(2000);

        const subResult = await page.evaluate((targets, opposites) => {
          const _ds = document.querySelectorAll('[role="dialog"]');
          let _fd = null;
          for (const _d of _ds) {
            if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
            _fd = _d; break;
          }
          const scope = _fd || document.querySelector('[role="main"]') || document;

          // Debug: dump all visible short texts in dialog
          const debugTexts = [];
          for (const el of scope.querySelectorAll('span')) {
            const t = (el.textContent || '').trim();
            if (t.length > 2 && t.length < 60) debugTexts.push(t);
          }

          // Look for elements with target text (For sale / For rent)
          const allEls = scope.querySelectorAll('span, div, a, [role="button"], [role="tab"], [role="radio"], [role="option"], [tabindex]');
          const candidates = [];
          for (const el of allEls) {
            const t = (el.textContent || '').trim();
            if (t.length < 3 || t.length > 50) continue;
            const tl = t.toLowerCase();
            // Must match target AND not contain opposite or "or rent"/"or sale"
            const matchesTarget = targets.some(x => tl === x.toLowerCase() || tl.includes(x.toLowerCase()));
            if (!matchesTarget) continue;
            const matchesOpposite = opposites.some(x => tl.includes(x.toLowerCase()));
            if (matchesOpposite) continue;
            // Skip category header texts that contain both
            if (/or rent|or sale|หรือเช่า|หรือขาย/i.test(t)) continue;
            // Skip long descriptions
            if (t.length > 30 && !/^(for sale|for rent|สำหรับขาย|ให้เช่า)$/i.test(t)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) continue;
            // Walk up to find clickable parent (card/button)
            let clickEl = el;
            for (let i = 0; i < 10; i++) {
              if (!clickEl.parentElement) break;
              clickEl = clickEl.parentElement;
              if (clickEl.getAttribute('role') === 'dialog') { clickEl = el; break; }
              const r = clickEl.getAttribute('role') || '';
              const hasIcon = clickEl.querySelector('i[data-visualcompletion="css-img"]');
              if (r === 'button' || r === 'tab' || r === 'radio' || r === 'option' || hasIcon) {
                break;
              }
            }
            const cr = clickEl.getBoundingClientRect();
            candidates.push({
              text: t, tag: el.tagName, role: el.getAttribute('role') || '',
              x: cr.x + cr.width / 2, y: cr.y + cr.height / 2,
              w: Math.round(cr.width), h: Math.round(cr.height)
            });
          }
          return { candidates, debugTexts: [...new Set(debugTexts)].slice(0, 30) };
        }, subTargets, subOpposites);

        if (subAttempt === 0) {
          console.log(`   🔍 Dialog texts: ${JSON.stringify(subResult.debugTexts)}`);
        }

        if (subResult.candidates.length > 0) {
          // Pick the best: prefer role=button/tab/radio, then smallest text
          const best = subResult.candidates.sort((a, b) => {
            const rs = (r) => ['button', 'tab', 'radio', 'option'].includes(r) ? 0 : 1;
            return rs(a.role) - rs(b.role) || a.text.length - b.text.length;
          })[0];
          console.log(`   📍 Found sub-category "${best.text}" (${best.tag}[role=${best.role}]) at y=${Math.round(best.y)} — clicking`);
          await page.mouse.click(best.x, best.y);
          await this.delay(3000);
          break;
        }

        if (subAttempt === 0) {
          console.log(`   ⚠️ No sub-category found yet, scrolling up and retrying...`);
          await page.evaluate(() => {
            const _ds = document.querySelectorAll('[role="dialog"]');
            for (const _d of _ds) {
              if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
              for (const el of _d.querySelectorAll('div')) {
                if (el.scrollHeight > el.clientHeight + 50) { el.scrollTop = 0; break; }
              }
              break;
            }
          });
        }
      }

      // Step 3: Fill the property form
      updateMsg('กำลังกรอกแบบฟอร์ม...');
      console.log('📝 Filling property form in buy/sell group...');
      const listingTypeLabel = this.mapListingType(property.listingType);
      const propertyTypeLabel = this.mapPropertyType(property.type || property.propertyType);
      const bedrooms = property.bedrooms?.toString() || '1';
      const bathrooms = property.bathrooms?.toString() || '1';
      const price = property.price?.toString() || '';
      const locationParts = [property.district, property.province].filter(Boolean);
      const location = locationParts.length > 0 ? locationParts.join(' ') : (property.location || '').split('|')[0].trim();
      const description = caption || property.description || '';
      const size = property.size?.toString() || '';

      // 3a. Upload images
      if (preparedFilePaths.length > 0) {
        updateMsg('อัพโหลดรูปภาพ...');
        await this.uploadImagesOnBuySellForm(page, preparedFilePaths);
      }

      // Verify dialog is still open after image upload
      const formStillOpen = await page.evaluate(() => {
        const ds = document.querySelectorAll('[role="dialog"]');
        for (const d of ds) {
          if (!/(notification|unread|การแจ้งเตือน)/i.test((d.textContent || '').slice(0, 500))) return { ok: true, mode: 'dialog' };
        }
        const main = document.querySelector('[role="main"]') || document;
        const t = (main.textContent || '').toLowerCase();
        const looksLikeListingForm = t.includes('choose listing type') || t.includes('listing type') || t.includes('type of property') || t.includes('property type') || t.includes('number of bedrooms') || t.includes('bedrooms') || t.includes('เลือกประเภทรายการ') || t.includes('ประเภทอสังหาริมทรัพย์') || t.includes('จำนวนห้องนอน');
        if (looksLikeListingForm) return { ok: true, mode: 'page' };
        return { ok: false, mode: 'unknown' };
      });
      if (!formStillOpen.ok) {
        console.log('❌ Listing form not detected after image upload!');
        return { success: false, error: 'ไม่พบฟอร์มลงประกาศหลังอัพโหลดรูป — กรุณาลองใหม่' };
      }
      console.log(`✅ Listing form detected — mode=${formStillOpen.mode}`);
      updateMsg('กรอกข้อมูลสินทรัพย์...');

      // 3b. Listing type: For Sale / For Rent — Facebook uses TABS/BUTTONS, not dropdown
      const listingTypeOk = await this.selectListingTypeTab(page, property.listingType || 'sale');
      if (!listingTypeOk) {
        return { success: false, error: 'ไม่สามารถเลือก Listing type (For sale/For rent) ได้' };
      }
      await this.delay(500);

      // 3c. Property type (Thai + English)
      // Facebook EN dropdown label = "Type", options: House, Townhouse, Flat/apartment, Room only
      const propTypeValues = Array.isArray(propertyTypeLabel) ? propertyTypeLabel : [propertyTypeLabel];
      await this.trySelectOnPage(page,
        property.listingType === 'rent'
          ? ['ประเภทของที่พักให้เช่า', 'ประเภท', 'Rental type', 'Property type', 'Home type', 'Type']
          : ['ประเภทอสังหาริมทรัพย์', 'ประเภทของที่พักสำหรับขาย', 'ประเภท', 'Property type', 'Home type', 'Type'],
        propTypeValues
      );
      await this.delay(500);

      // 3d. Bedrooms — try text input first, then dropdown fallback (Facebook may use combobox)
      await this.tryTypeOnPage(page, ['จำนวนห้องนอน', 'Bedrooms', 'Number of bedrooms', 'Beds'], bedrooms, { alsoTryDropdown: true });
      await this.delay(300);

      // 3e. Bathrooms — try text input first, then dropdown fallback
      await this.tryTypeOnPage(page, ['จำนวนห้องน้ำ', 'Bathrooms', 'Number of bathrooms', 'Baths'], bathrooms, { alsoTryDropdown: true });
      await this.delay(300);

      // 3f. Price
      await this.tryTypeOnPage(page,
        property.listingType === 'rent'
          ? ['ราคาต่อเดือน', 'Price per month', 'Monthly rent', 'Price']
          : ['ราคา', 'Price'],
        price
      );
      await this.delay(300);

      // ── SCROLL DOWN to force Facebook to render Location/Description/Size fields ──
      console.log('📜 Scrolling down to reveal remaining fields...');
      for (let scrollI = 0; scrollI < 5; scrollI++) {
        await this.scrollDownInDialog(page, 400);
        await this.delay(800);
      }
      // Debug: dump all visible form labels after scrolling
      const formLabels = await page.evaluate(() => {
        const _ds = document.querySelectorAll('[role="dialog"]');
        let dialog = null;
        for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; dialog = _d; break; }
        const scope = dialog || document.querySelector('[role="main"]') || document;
        const labels = [];
        // Check labels
        scope.querySelectorAll('label span, label').forEach(el => {
          const t = (el.textContent || '').trim();
          if (t.length > 1 && t.length < 50) labels.push(t);
        });
        // Check inputs with placeholders or aria-labels
        scope.querySelectorAll('input, textarea').forEach(el => {
          const ph = el.placeholder || '';
          const al = el.getAttribute('aria-label') || '';
          if (ph) labels.push(`[placeholder: ${ph}]`);
          if (al) labels.push(`[aria-label: ${al}]`);
        });
        // Check div[role=textbox] / contenteditable
        scope.querySelectorAll('div[role="textbox"], div[contenteditable="true"]').forEach(el => {
          const al = el.getAttribute('aria-label') || '';
          if (al) labels.push(`[textbox aria-label: ${al}]`);
        });
        return [...new Set(labels)].slice(0, 40);
      });
      console.log(`🔍 Form labels after scroll:`, JSON.stringify(formLabels));

      // 3g. Location
      await this.nativeFillLocationOnPage(page, location);
      await this.delay(500);

      // 3h. Description — scroll down more first
      await this.scrollDownInDialog(page, 400);
      await this.delay(500);
      await this.tryTypeTextareaOnPage(page,
        property.listingType === 'rent'
          ? ['คำอธิบายของที่พักให้เช่า', 'คำอธิบาย', 'Rental description', 'Property for rent description', 'Description']
          : ['คำอธิบายอสังหาริมทรัพย์', 'คำอธิบาย', 'Property description', 'Property for sale description', 'Property for rent description', 'Description'],
        description
      );
      await this.delay(300);

      // 3i. Square meters — scroll down more first
      if (size && size !== '0') {
        await this.scrollDownInDialog(page, 400);
        await this.delay(500);
        await this.tryTypeOnPage(page, ['ตารางเมตร', 'Square meters', 'Square feet', 'Property square feet', 'Property square meters', 'Area', 'Size', 'พื้นที่'], size);
        await this.delay(300);
      }

      console.log('✅ Form filled!');

      // COMPREHENSIVE FIELD AUDIT — dump EVERY field's state before clicking Next
      const fieldAudit = await page.evaluate(() => {
        const _ds = document.querySelectorAll('[role="dialog"]');
        let _fd = null;
        for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
        const scope = _fd || document.querySelector('[role="main"]') || document;
        const fields = [];
        // Check all inputs
        scope.querySelectorAll('input').forEach(inp => {
          if (inp.type === 'hidden' || inp.type === 'file') return;
          const label = inp.getAttribute('aria-label') || inp.placeholder || inp.name || '';
          fields.push({ type: `input[${inp.type || 'text'}]`, label, value: inp.value || '', filled: !!inp.value });
        });
        // Check all comboboxes
        scope.querySelectorAll('[role="combobox"]').forEach(cb => {
          const label = cb.getAttribute('aria-label') || '';
          const value = (cb.textContent || '').trim().slice(0, 30);
          fields.push({ type: 'combobox', label, value, filled: value.length > 0 });
        });
        // Check all textboxes
        scope.querySelectorAll('div[role="textbox"], textarea').forEach(tb => {
          const label = tb.getAttribute('aria-label') || '';
          const value = (tb.textContent || tb.value || '').trim().slice(0, 30);
          fields.push({ type: 'textbox', label, value, filled: value.length > 0 });
        });
        // Check all selects
        scope.querySelectorAll('select').forEach(sel => {
          const label = sel.getAttribute('aria-label') || sel.name || '';
          fields.push({ type: 'select', label, value: sel.value, filled: !!sel.value });
        });
        return { fields, unfilled: fields.filter(f => !f.filled).map(f => `${f.type} "${f.label}"`) };
      });
      console.log('📋 FIELD AUDIT:', JSON.stringify(fieldAudit.unfilled || fieldAudit.error));
      if (fieldAudit.fields) {
        console.log('📋 ALL FIELDS:', JSON.stringify(fieldAudit.fields));
      }

      // Step 4: Click "ถัดไป" (Next) — scrollIntoView first, then native mouse click
      updateMsg('กดถัดไป...');
      console.log('🔄 Clicking "ถัดไป"...');
      let nextClicked = false;
      for (let attempt = 0; attempt < 5 && !nextClicked; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry ถัดไป ${attempt + 1}/5...`);
          await this.delay(2000);
          await this.scrollDownInDialog(page, 500);
        }
        // STEP A: Find Next button + scrollIntoView so it's visible in viewport
        const nextBox = await page.evaluate(() => {
          const _ds = document.querySelectorAll('[role="dialog"]');
          let _fd = null;
          for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
          const scope = _fd || document;
          const buttons = scope.querySelectorAll('[role="button"], button');
          let disabledInfo = null;
          let targetBtn = null;
          for (const btn of buttons) {
            const spans = btn.querySelectorAll('span');
            let btnText = '';
            if (spans.length > 0) {
              for (const s of spans) {
                const t = (s.textContent || '').trim();
                if (t === 'ถัดไป' || t === 'Next') { btnText = t; break; }
              }
            }
            if (!btnText) btnText = (btn.textContent || '').trim();
            const label = btn.getAttribute('aria-label') || '';
            if (btnText === 'ถัดไป' || btnText === 'Next' || label === 'ถัดไป' || label === 'Next') {
              const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
              if (isDisabled) {
                disabledInfo = { text: btnText, disabled: true };
                continue;
              }
              targetBtn = btn;
              break;
            }
          }
          if (!targetBtn) {
            if (disabledInfo) return { found: false, disabled: true, text: disabledInfo.text };
            return { found: false, disabled: false };
          }
          // CRITICAL: Scroll the button into view before getting coordinates
          targetBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
          // Force reflow
          void targetBtn.offsetHeight;
          const rect = targetBtn.getBoundingClientRect();
          const vpH = window.innerHeight || document.documentElement.clientHeight;
          return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            found: true,
            text: (targetBtn.textContent || '').trim().slice(0, 20),
            viewportH: vpH,
            inViewport: rect.y >= 0 && rect.y + rect.height <= vpH
          };
        });

        if (!nextBox.found && nextBox.disabled && attempt === 0) {
          console.log(`   ⚠️ Next button found but DISABLED — required fields may be missing`);
          // Debug: dump ALL fields — filled AND empty — to see what's wrong
          const allFields = await page.evaluate(() => {
            const _ds = document.querySelectorAll('[role="dialog"]');
            let _fd = null;
            for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
            const scope = _fd || document.querySelector('[role="main"]') || document;
            const empty = [], all = [];
            scope.querySelectorAll('input').forEach(inp => {
              if (inp.type === 'hidden' || inp.type === 'file') return;
              const desc = `input[${inp.type || 'text'}] aria="${inp.getAttribute('aria-label') || ''}" ph="${inp.placeholder || ''}" val="${(inp.value || '').slice(0, 20)}"`;
              all.push(desc);
              if (!inp.value) empty.push(desc);
            });
            scope.querySelectorAll('[role="combobox"]').forEach(cb => {
              const txt = (cb.textContent || '').trim().slice(0, 30);
              const desc = `combobox aria="${cb.getAttribute('aria-label') || ''}" txt="${txt}"`;
              all.push(desc);
              // Combobox with no selection often shows placeholder text
              if (!txt || txt.length < 2) empty.push(desc);
            });
            scope.querySelectorAll('textarea, div[role="textbox"]').forEach(tb => {
              const val = (tb.value || tb.textContent || '').trim().slice(0, 20);
              const desc = `${tb.tagName === 'TEXTAREA' ? 'textarea' : 'textbox'} aria="${tb.getAttribute('aria-label') || ''}" val="${val}"`;
              all.push(desc);
              if (!val) empty.push(desc);
            });
            return { empty: empty.slice(0, 10), all: all.slice(0, 20) };
          });
          console.log(`   🔍 EMPTY fields:`, JSON.stringify(allFields.empty));
          console.log(`   🔍 ALL fields:`, JSON.stringify(allFields.all));
        }

        if (nextBox.found) {
          console.log(`   📍 "ถัดไป" at (${Math.round(nextBox.x)}, ${Math.round(nextBox.y)}) text="${nextBox.text}" viewport=${nextBox.viewportH} inView=${nextBox.inViewport}`);

          // METHOD 1 (most reliable): Puppeteer elementHandle.click() — handles scroll + click natively
          let clickedViaHandle = false;
          try {
            const nextHandle = await page.evaluateHandle(() => {
              const _ds = document.querySelectorAll('[role="dialog"]');
              let _fd = null;
              for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
              const scope = _fd || document;
              for (const btn of scope.querySelectorAll('[role="button"], button')) {
                for (const s of btn.querySelectorAll('span')) {
                  const t = (s.textContent || '').trim();
                  if ((t === 'ถัดไป' || t === 'Next') && btn.getAttribute('aria-disabled') !== 'true' && !btn.disabled) return btn;
                }
              }
              return null;
            });
            if (nextHandle.asElement()) {
              await nextHandle.asElement().click();
              clickedViaHandle = true;
              console.log(`   ✅ Clicked via Puppeteer elementHandle.click()`);
            }
            await nextHandle.dispose();
          } catch (e) {
            console.log(`   ⚠️ elementHandle.click() failed: ${e.message}`);
          }

          // METHOD 2: dispatchEvent full mouse sequence
          if (!clickedViaHandle) {
            await page.evaluate(() => {
              const _ds = document.querySelectorAll('[role="dialog"]');
              let _fd = null;
              for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
              const scope = _fd || document;
              for (const btn of scope.querySelectorAll('[role="button"], button')) {
                for (const s of btn.querySelectorAll('span')) {
                  const t = (s.textContent || '').trim();
                  if ((t === 'ถัดไป' || t === 'Next') && btn.getAttribute('aria-disabled') !== 'true') {
                    btn.scrollIntoView({ block: 'center', behavior: 'instant' });
                    const rect = btn.getBoundingClientRect();
                    const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
                    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
                    btn.dispatchEvent(new MouseEvent('mousedown', opts));
                    btn.dispatchEvent(new MouseEvent('mouseup', opts));
                    btn.dispatchEvent(new MouseEvent('click', opts));
                    btn.dispatchEvent(new PointerEvent('pointerdown', opts));
                    btn.dispatchEvent(new PointerEvent('pointerup', opts));
                    return;
                  }
                }
              }
            });
            console.log(`   📍 Clicked via dispatchEvent (mouse+pointer)`);
          }

          // METHOD 3: Focus + Enter as final fallback
          await this.delay(500);
          await page.evaluate(() => {
            const _ds = document.querySelectorAll('[role="dialog"]');
            let _fd = null;
            for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
            const scope = _fd || document;
            for (const btn of scope.querySelectorAll('[role="button"], button')) {
              for (const s of btn.querySelectorAll('span')) {
                if ((s.textContent || '').trim() === 'Next' || (s.textContent || '').trim() === 'ถัดไป') {
                  btn.focus();
                  return;
                }
              }
            }
          });
          await page.keyboard.press('Enter');
          console.log(`   ⌨️ Also focus+Enter as fallback`);

          nextClicked = true;

          // VERIFY: Did the page actually change?
          await this.delay(4000);
          const pageChanged = await page.evaluate(() => {
            const _ds = document.querySelectorAll('[role="dialog"]');
            let _fd = null;
            for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
            if (!_fd) return { changed: true, reason: 'no-dialog' };
            const txt = (_fd.textContent || '').toLowerCase();
            const stillOnForm = txt.includes('choose listing type') || txt.includes('number of bedrooms') || txt.includes('เลือกประเภทรายการ');
            // Also check what element is at click coords for debugging
            const topEl = document.elementFromPoint(960, 300);
            const topTag = topEl ? `${topEl.tagName}.${topEl.getAttribute('role') || ''}` : 'null';
            if (stillOnForm) return { changed: false, reason: 'form-still-visible', topElement: topTag };
            return { changed: true, reason: 'form-gone' };
          });
          console.log(`   🔍 Page changed: ${pageChanged.changed} (${pageChanged.reason})${pageChanged.topElement ? ' topEl=' + pageChanged.topElement : ''}`);

          if (!pageChanged.changed) {
            console.log(`   ⚠️ Next click didn't advance — retrying with mouse.click...`);
            // Last resort: direct mouse click at the coordinates
            await page.mouse.click(nextBox.x, nextBox.y);
            await this.delay(1000);
            await page.mouse.click(nextBox.x, nextBox.y);
            await this.delay(4000);
          }
        }
      }

      if (!nextClicked) {
        return { success: false, error: 'ไม่สามารถกดปุ่มถัดไปได้' };
      }

      // ══════════════════════════════════════════════════════════════
      // POST-NEXT: State-aware flow — detect what Facebook shows and act
      // ══════════════════════════════════════════════════════════════
      console.log('⏳ Waiting after Next...');
      await this.delay(4000);

      // Detect what state we're in after clicking Next
      const postNextState = await page.evaluate(() => {
        const _ds = document.querySelectorAll('[role="dialog"]');
        let formDialog = null;
        for (const _d of _ds) {
          if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
          formDialog = _d; break;
        }

        // CASE A: No dialog (excluding Notifications) → listing may have published directly
        if (!formDialog) return { state: 'no-dialog' };

        const dialogText = (formDialog.textContent || '').toLowerCase();
        const spans = formDialog.querySelectorAll('span');
        const visibleTexts = [];
        for (const s of spans) {
          const t = (s.textContent || '').trim();
          if (t.length > 1 && t.length < 60) visibleTexts.push(t);
        }
        const uniqueTexts = [...new Set(visibleTexts)].slice(0, 30);

        // Negative check: if form indicators still visible, we're STILL on the form page
        const formIndicators = ['choose listing type', 'number of bedrooms', 'number of bathrooms',
          'เลือกประเภทรายการ', 'จำนวนห้องนอน', 'type of property'];
        const stillOnForm = formIndicators.some(fi => dialogText.includes(fi));

        // CASE D: Success message — ONLY if NOT still on form page
        if (!stillOnForm) {
          const successKws = ['listing published', 'เผยแพร่รายการ', 'your listing has been', 'รายการของคุณ', 'listed successfully', 'สำเร็จแล้ว', 'published to'];
          if (successKws.some(kw => dialogText.includes(kw))) {
            return { state: 'success', texts: uniqueTexts };
          }
        }

        // Collect all buttons in dialog
        const buttons = formDialog.querySelectorAll('[role="button"], button');
        const btnInfo = [];
        for (const btn of buttons) {
          const innerSpans = btn.querySelectorAll('span');
          let text = '';
          for (const s of innerSpans) { const t = (s.textContent || '').trim(); if (t.length > 0 && t.length < 30) { text = t; break; } }
          if (!text) text = (btn.textContent || '').trim();
          if (text.length > 0 && text.length < 40) {
            const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
            const rect = btn.getBoundingClientRect();
            btnInfo.push({ text, disabled, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height });
          }
        }

        // CASE C: Share page with Marketplace
        const hasMarketplace = dialogText.includes('marketplace') || dialogText.includes('มาร์เก็ตเพลส');

        // Find any publish/post button
        const postKws = ['โพสต์', 'post', 'ลงประกาศ', 'publish', 'submit', 'list item', 'create listing', 'done', 'เสร็จ'];
        let postBtn = null;
        let disabledPostBtn = null;
        for (const bi of btnInfo) {
          const lower = bi.text.toLowerCase();
          if (!postKws.some(kw => lower === kw || lower.includes(kw))) continue;
          if (bi.disabled) { disabledPostBtn = bi; continue; }
          if (bi.w > 0 && bi.h > 0) { postBtn = bi; break; }
        }

        return {
          state: hasMarketplace ? 'share-page' : 'dialog-open',
          texts: uniqueTexts,
          buttons: btnInfo.map(b => `${b.text}${b.disabled ? ' [DISABLED]' : ''}`).slice(0, 15),
          postBtn: postBtn ? { x: postBtn.x, y: postBtn.y, text: postBtn.text, found: true } : null,
          disabledPostBtn: disabledPostBtn ? { text: disabledPostBtn.text } : null,
          hasMarketplace,
        };
      });

      console.log(`🔍 After Next — state: ${postNextState.state}`);
      if (postNextState.texts) console.log(`   📋 Texts: ${JSON.stringify(postNextState.texts)}`);
      if (postNextState.buttons) console.log(`   🔘 Buttons: ${JSON.stringify(postNextState.buttons)}`);

      // ── CASE A: Dialog closed — listing published directly ──
      if (postNextState.state === 'no-dialog') {
        console.log('✅ Dialog closed after Next — verifying publish result...');

        const checkResult = async () => {
          return page.evaluate(() => {
            const url = location.href;
            const title = document.title || '';

            const toastSelectors = '[role="alert"], [role="status"], [aria-live="polite"], [aria-live="assertive"]';
            const toastTexts = [];
            document.querySelectorAll(toastSelectors).forEach(el => {
              const t = (el.textContent || '').trim();
              if (t.length > 2 && t.length < 250) toastTexts.push(t);
            });

            const allText = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
            const pendingKws = ['pending approval', 'awaiting approval', 'pending', 'รอการอนุมัติ', 'กำลังรอการอนุมัติ', 'รอดำเนินการ'];
            const successKws = ['listing published', 'listed successfully', 'your listing has been', 'published to', 'posted to', 'เผยแพร่', 'ลงประกาศแล้ว', 'โพสต์แล้ว', 'สำเร็จ'];

            const pendingText = pendingKws.find(kw => allText.includes(kw)) || '';
            const successText = successKws.find(kw => allText.includes(kw)) || '';

            const urls = [];
            document.querySelectorAll('a[href]').forEach(a => {
              const href = a.href || '';
              if (!href) return;
              const isMarketplaceItem = href.includes('/marketplace/item/');
              const isPermalink = href.includes('/permalink/');
              const isBuySell = href.includes('/buy_sell/');
              const isGroupPost = href.includes('/groups/') && href.includes('/posts/');
              if (isMarketplaceItem || isPermalink || isBuySell || isGroupPost) urls.push(href);
            });
            const postUrl = [...new Set(urls)][0] || null;

            const postKws = ['โพสต์', 'post', 'ลงประกาศ', 'publish', 'submit', 'list item', 'create listing', 'done', 'เสร็จ', 'ตกลง'];
            let postBtnText = '';
            let postBtnDisabled = false;
            for (const btn of document.querySelectorAll('[role="button"], button')) {
              const spans = btn.querySelectorAll('span');
              let text = '';
              for (const s of spans) {
                const t = (s.textContent || '').trim();
                if (t.length > 0 && t.length < 35) { text = t; break; }
              }
              if (!text) text = (btn.textContent || '').trim();
              const lower = text.toLowerCase();
              if (!postKws.some(kw => lower === kw || lower.includes(kw))) continue;
              const rect = btn.getBoundingClientRect();
              if (rect.width < 40 || rect.height < 18) continue;
              postBtnText = text.slice(0, 40);
              postBtnDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
              break;
            }

            return {
              url,
              title: title.slice(0, 80),
              toasts: [...new Set(toastTexts)].slice(0, 10),
              pendingText,
              successText,
              postUrl,
              postBtnText,
              postBtnDisabled,
            };
          });
        };

        let verify1 = null;
        try {
          verify1 = await checkResult();
        } catch (e) {
          console.log(`   ⚠️ Verify (pass 1) failed: ${e.message}`);
        }

        if (verify1) {
          console.log(`   🌐 URL: ${verify1.url}`);
          if (verify1.toasts?.length) console.log(`   🔔 Toasts: ${JSON.stringify(verify1.toasts)}`);
          if (verify1.pendingText) console.log(`   🕓 Pending indicator: ${verify1.pendingText}`);
          if (verify1.successText) console.log(`   ✅ Success indicator: ${verify1.successText}`);
          if (verify1.postUrl) console.log(`   🔗 Post URL: ${verify1.postUrl}`);
        }

        if (verify1?.postUrl) {
          console.log('✅ Buy/sell listing posted successfully!');
          return { success: true, postUrl: verify1.postUrl };
        }

        if (verify1?.pendingText) {
          console.log('✅ Listing submitted (pending approval)');
          return { success: true, postUrl: null, pendingApproval: true };
        }

        if (verify1?.successText) {
          console.log('✅ Success indicator detected (no URL)');
          return { success: true, postUrl: null };
        }

        if (verify1?.postBtnText && !verify1.postBtnDisabled) {
          console.log(`   📍 Found page-level post button "${verify1.postBtnText}" — clicking...`);
          try {
            const postHandle = await page.evaluateHandle((postKws) => {
              const kws = postKws.map(k => k.toLowerCase());
              for (const btn of document.querySelectorAll('[role="button"], button')) {
                const spans = btn.querySelectorAll('span');
                let text = '';
                for (const s of spans) {
                  const t = (s.textContent || '').trim();
                  if (t.length > 0 && t.length < 35) { text = t; break; }
                }
                if (!text) text = (btn.textContent || '').trim();
                const lower = text.toLowerCase();
                if (!kws.some(kw => lower === kw || lower.includes(kw))) continue;
                const dis = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
                if (dis) continue;
                const rect = btn.getBoundingClientRect();
                if (rect.width < 40 || rect.height < 18) continue;
                return btn;
              }
              return null;
            }, ['โพสต์', 'post', 'ลงประกาศ', 'publish', 'submit', 'list item', 'create listing', 'done', 'เสร็จ', 'ตกลง']);

            if (postHandle.asElement()) {
              await postHandle.asElement().click();
              console.log('   ✅ Page-level post button clicked');
            }
            await postHandle.dispose();
          } catch (e) {
            console.log(`   ⚠️ Page-level post button click failed: ${e.message}`);
          }

          await this.delay(5000);

          let verify2 = null;
          try {
            verify2 = await checkResult();
          } catch (e) {
            console.log(`   ⚠️ Verify (pass 2) failed: ${e.message}`);
          }

          if (verify2) {
            console.log(`   🌐 URL: ${verify2.url}`);
            if (verify2.toasts?.length) console.log(`   🔔 Toasts: ${JSON.stringify(verify2.toasts)}`);
            if (verify2.pendingText) console.log(`   🕓 Pending indicator: ${verify2.pendingText}`);
            if (verify2.successText) console.log(`   ✅ Success indicator: ${verify2.successText}`);
            if (verify2.postUrl) console.log(`   🔗 Post URL: ${verify2.postUrl}`);
          }

          if (verify2?.postUrl) {
            console.log('✅ Buy/sell listing posted successfully!');
            return { success: true, postUrl: verify2.postUrl };
          }
          if (verify2?.pendingText) {
            console.log('✅ Listing submitted (pending approval)');
            return { success: true, postUrl: null, pendingApproval: true };
          }
          if (verify2?.successText) {
            console.log('✅ Success indicator detected (no URL)');
            return { success: true, postUrl: null };
          }
        }

        console.log('❌ Dialog closed but no publish confirmation detected');
        return { success: false, error: 'กดถัดไปแล้ว dialog ปิด แต่ไม่พบสัญญาณยืนยันว่าโพสต์สำเร็จ/รออนุมัติ (อาจปิดหน้าต่างหรือยังไม่ได้กด Post)' };
      }

      // ── CASE D: Success message shown ──
      if (postNextState.state === 'success') {
        console.log('✅ Success message detected in dialog!');
        // Click Done/OK/Close if present
        const doneResult = await this._clickButtonInDialog(page, ['Done', 'OK', 'เสร็จ', 'ตกลง', 'Close', 'ปิด']);
        if (doneResult) console.log('   📍 Clicked done/close button');
        await this.delay(2000);
        console.log('✅ Buy/sell listing posted successfully!');
        return { success: true, postUrl: null };
      }

      // ── CASE C: Share page with Marketplace ──
      if (postNextState.hasMarketplace) {
        console.log('📌 Share page detected — ticking Marketplace...');
        updateMsg('ติ้ก Marketplace...');
        // Try to tick Marketplace
        const mktBox = await page.evaluate(() => {
          const _ds = document.querySelectorAll('[role="dialog"]');
          let _fd = null;
          for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
          if (!_fd) return { found: false };
          const spans = _fd.querySelectorAll('span');
          for (const span of spans) {
            const text = (span.textContent || '').trim();
            if (text !== 'Marketplace') continue;
            let row = span;
            for (let i = 0; i < 10; i++) {
              if (!row.parentElement) break;
              row = row.parentElement;
              const cb = row.querySelector('input[type="checkbox"], [role="checkbox"], [role="switch"]');
              if (cb) {
                if (cb.checked || cb.getAttribute('aria-checked') === 'true') return { already: true };
                const r = cb.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
              }
              const r = row.getBoundingClientRect();
              if (r.height > 40 && r.height < 140 && r.width > 200) {
                return { x: r.x + r.width - 30, y: r.y + r.height / 2, found: true };
              }
            }
          }
          return { found: false };
        });
        if (mktBox.already) {
          console.log('   ✅ Marketplace already checked');
        } else if (mktBox.found) {
          await page.mouse.click(mktBox.x, mktBox.y);
          console.log('   ✅ Marketplace checkbox clicked');
        } else {
          console.log('   ⚠️ Marketplace checkbox not found on share page');
        }
        await this.delay(1500);
      }

      // ── CASES B & C: Find and click Post/Publish button ──
      updateMsg('กำลังกดโพสต์...');
      let posted = false;
      const postKeywords = ['โพสต์', 'Post', 'ลงประกาศ', 'Publish', 'Submit', 'List item', 'Create listing', 'Done', 'เสร็จ'];

      // Use elementHandle.click() for reliable Post button clicking
      for (let attempt = 0; attempt < 8 && !posted; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry post button ${attempt + 1}/8...`);
          await this.delay(2000);
        }

        // Check if dialog is gone (listing published)
        const hasDialog = await page.evaluate(() => {
          const _ds = document.querySelectorAll('[role="dialog"]');
          for (const _d of _ds) {
            if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
            return true;
          }
          return false;
        });
        if (!hasDialog) {
          console.log('   ✅ Dialog closed — listing published!');
          posted = true;
          break;
        }

        try {
          const postHandle = await page.evaluateHandle((keywords) => {
            const _ds = document.querySelectorAll('[role="dialog"]');
            let _fd = null;
            for (const _d of _ds) {
              if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue;
              _fd = _d; break;
            }
            const scope = _fd || document;
            const buttons = scope.querySelectorAll('[role="button"], button');
            for (const btn of buttons) {
              const spans = btn.querySelectorAll('span');
              let text = '';
              for (const s of spans) {
                const t = (s.textContent || '').trim();
                if (keywords.some(kw => t.toLowerCase() === kw.toLowerCase())) { text = t; break; }
              }
              if (!text) {
                const ft = (btn.textContent || '').trim();
                if (ft.length < 30 && keywords.some(kw => ft.toLowerCase() === kw.toLowerCase())) text = ft;
              }
              const label = btn.getAttribute('aria-label') || '';
              if (!text && keywords.some(kw => label.toLowerCase() === kw.toLowerCase())) text = label;
              if (!text) continue;
              const isDis = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
              if (isDis) continue;
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) return btn;
            }
            return null;
          }, postKeywords);

          if (postHandle.asElement()) {
            const btnText = await page.evaluate(el => {
              for (const s of el.querySelectorAll('span')) { const t = (s.textContent || '').trim(); if (t.length > 0 && t.length < 30) return t; }
              return (el.textContent || '').trim().slice(0, 30);
            }, postHandle);
            console.log(`   📍 Post button "${btnText}" found — clicking via elementHandle...`);
            await postHandle.asElement().click();
            await postHandle.dispose();
            posted = true;
            console.log(`   ✅ "${btnText}" clicked!`);
          } else {
            await postHandle.dispose();
            if (attempt === 0) {
              // Debug: show what buttons are available
              const availBtns = await page.evaluate(() => {
                const _ds = document.querySelectorAll('[role="dialog"]');
                let _fd = null;
                for (const _d of _ds) { if (/(notification|unread|การแจ้งเตือน)/i.test((_d.textContent || '').slice(0, 500))) continue; _fd = _d; break; }
                if (!_fd) return [];
                const btns = [];
                for (const b of _fd.querySelectorAll('[role="button"], button')) {
                  const t = (b.textContent || '').trim();
                  if (t.length > 0 && t.length < 40) btns.push(t);
                }
                return [...new Set(btns)].slice(0, 15);
              });
              console.log(`   🔘 Available buttons: ${JSON.stringify(availBtns)}`);
            }
          }
        } catch (e) {
          console.log(`   ⚠️ Post button click error: ${e.message}`);
        }
      }

      if (!posted) {
        return { success: false, error: 'ไม่สามารถกดปุ่มโพสต์ได้' };
      }

      // Wait for post to complete
      console.log('⏳ Waiting for post to complete...');
      await this.delay(5000);

      // Check for any final confirmation dialog (e.g. "ลงประกาศ" / "Publish" on success dialog)
      const finalBtn = await this._clickButtonInDialog(page, ['ลงประกาศ', 'Publish', 'List Item', 'Done', 'OK', 'เสร็จ', 'ตกลง']);
      if (finalBtn) {
        console.log(`   ✅ Final button "${finalBtn}" clicked`);
        await this.delay(3000);
      } else {
        console.log('   ℹ️ No final confirmation dialog');
      }

      const finalVerify = await page.evaluate(() => {
        const url = location.href;
        const title = document.title || '';

        const toastSelectors = '[role="alert"], [role="status"], [aria-live="polite"], [aria-live="assertive"]';
        const toastTexts = [];
        document.querySelectorAll(toastSelectors).forEach(el => {
          const t = (el.textContent || '').trim();
          if (t.length > 2 && t.length < 250) toastTexts.push(t);
        });

        const allText = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
        const pendingKws = ['pending approval', 'awaiting approval', 'pending', 'รอการอนุมัติ', 'กำลังรอการอนุมัติ', 'รอดำเนินการ'];
        const successKws = ['listing published', 'listed successfully', 'your listing has been', 'published to', 'posted to', 'เผยแพร่', 'ลงประกาศแล้ว', 'โพสต์แล้ว', 'สำเร็จ'];
        const pendingText = pendingKws.find(kw => allText.includes(kw)) || '';
        const successText = successKws.find(kw => allText.includes(kw)) || '';

        const urls = [];
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.href || '';
          if (!href) return;
          const isMarketplaceItem = href.includes('/marketplace/item/');
          const isPermalink = href.includes('/permalink/');
          const isBuySell = href.includes('/buy_sell/');
          const isGroupPost = href.includes('/groups/') && href.includes('/posts/');
          if (isMarketplaceItem || isPermalink || isBuySell || isGroupPost) urls.push(href);
        });
        const postUrl = [...new Set(urls)][0] || null;

        return {
          url,
          title: title.slice(0, 80),
          toasts: [...new Set(toastTexts)].slice(0, 10),
          pendingText,
          successText,
          postUrl,
        };
      });

      console.log(`   🌐 URL: ${finalVerify.url}`);
      if (finalVerify.toasts?.length) console.log(`   🔔 Toasts: ${JSON.stringify(finalVerify.toasts)}`);
      if (finalVerify.pendingText) console.log(`   🕓 Pending indicator: ${finalVerify.pendingText}`);
      if (finalVerify.successText) console.log(`   ✅ Success indicator: ${finalVerify.successText}`);
      if (finalVerify.postUrl) console.log(`   🔗 Post URL: ${finalVerify.postUrl}`);

      if (finalVerify.postUrl) {
        console.log('✅ Buy/sell listing posted successfully!');
        return { success: true, postUrl: finalVerify.postUrl };
      }
      if (finalVerify.pendingText) {
        console.log('✅ Listing submitted (pending approval)');
        return { success: true, postUrl: null, pendingApproval: true };
      }
      if (finalVerify.successText) {
        console.log('✅ Success indicator detected (no URL)');
        return { success: true, postUrl: null };
      }

      console.log('❌ Post click finished but no publish confirmation detected');
      return { success: false, error: 'กดโพสต์แล้ว แต่ไม่พบสัญญาณยืนยันว่าโพสต์สำเร็จ/รออนุมัติ (อาจถูกปฏิเสธ/เงื่อนไขกลุ่ม/FB ไม่รับโพสต์)' };

    } catch (error) {
      console.error('❌ Buy/sell listing error:', error.message);
      return { success: false, error: `กลุ่มซื้อขาย — ${error.message}` };
    }
  }

  async initialize(browserType = 'chrome') {
    // Close existing browser if any
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) { }
      this.browser = null;
      this.page = null;
    }

    this.selectedBrowser = browserType;

    const isVPS = process.platform === 'linux';
    const isHeadless = process.env.HEADLESS === 'true';

    // Per-user profile directory
    const appProfileDir = this.userDataDir;
    if (!fs.existsSync(appProfileDir)) {
      fs.mkdirSync(appProfileDir, { recursive: true });
    }

    const vpsArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
    ];
    const localArgs = [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
    ];
    const launchOptions = {
      headless: isHeadless ? 'new' : false,
      defaultViewport: isHeadless ? { width: 1920, height: 2160 } : null,
      userDataDir: appProfileDir,
      protocolTimeout: 120000,
      args: isVPS ? vpsArgs : localArgs,
    };

    // On Windows: use local browser; On VPS: use system Google Chrome
    if (isVPS) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
    } else {
      const executablePath = findBrowserPath(browserType);
      if (!executablePath) {
        throw new Error(`ไม่พบ ${browserType} ในเครื่อง กรุณาติดตั้งก่อน`);
      }
      launchOptions.executablePath = executablePath;
    }

    const shortId = this.userId.substring(0, 8);
    console.log(`🚀 [${shortId}] Launching ${isVPS ? 'Chromium (VPS)' : browserType}...`);
    console.log(`📁 Profile: ${appProfileDir}`);
    console.log(`👁️ Headless: ${isHeadless}`);

    this.browser = await puppeteer.launch(launchOptions);

    // Listen for browser disconnect (user closes browser)
    this.browser.on('disconnected', () => {
      console.log('🔴 Browser was closed by user');
      this.handleBrowserClosed();
    });

    await this.delay(1000);

    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8'
    });

    console.log(`✅ ${browserType} เปิดแล้ว`);
    console.log(`💡 ถ้ายังไม่ Login Facebook ให้ Login ครั้งแรก - ระบบจะจำไว้`);
  }

  // Handle browser closed by user (clicked X)
  handleBrowserClosed() {
    const wasRunning = this.isRunning;
    console.log('🔄 Handling browser disconnect...');

    if (wasRunning && this.tasks.length > 0) {
      for (const task of this.tasks) {
        if (task.status === 'pending' || task.status === 'in_progress') {
          task.status = 'failed';
          task.message = '❌ Browser ถูกปิดระหว่างทำงาน';
        }
      }
      this.endTime = Date.now();
      this.addLog('❌ Browser ถูกปิดระหว่าง automation — หยุดการทำงาน', 'error');
    }

    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.isPaused = false;
    this.currentTask = null;
    console.log('✅ Browser state reset');
  }

  async close() {
    const wasRunning = this.isRunning;
    this.isRunning = false;
    this.isPaused = false;

    if (wasRunning && this.tasks.length > 0) {
      for (const task of this.tasks) {
        if (task.status === 'pending' || task.status === 'in_progress') {
          task.status = 'failed';
          task.message = '❌ ปิด browser ระหว่างทำงาน';
        }
      }
      this.endTime = Date.now();
      this.addLog('❌ ปิด Browser ระหว่าง automation', 'error');
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✅ Browser closed');
    }
  }

  // Check if user is logged in to Facebook
  async checkLogin() {
    try {
      // Check if browser is still connected
      if (!this.browser || !this.browser.isConnected()) {
        console.log('⚠️ Browser not connected');
        return false;
      }

      await this.page.goto('https://www.facebook.com', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await this.delay(2000);

      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('input[name="email"]') &&
          !document.querySelector('button[name="login"]');
      });

      if (!isLoggedIn) {
        console.log('📌 ยังไม่ได้ Login - หน้า Facebook เปิดอยู่แล้ว กรุณา Login');
      }

      return isLoggedIn;
    } catch (error) {
      console.error('Login check error:', error.message);
      return false;
    }
  }

  // Check if browser is still open and connected
  isBrowserConnected() {
    return this.browser && this.browser.isConnected();
  }

  // Handle notification permission dialog (click Allow/อนุญาต)
  async handleNotificationPermission() {
    console.log('🔔 Checking for notification permission dialog...');

    try {
      await this.delay(1500);

      const clicked = await this.page.evaluate(() => {
        // Find all buttons
        const buttons = document.querySelectorAll('button, [role="button"], div[tabindex="0"]');

        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';

          // Check for Allow/อนุญาต button
          if (text === 'อนุญาต' ||
            text === 'Allow' ||
            text.includes('อนุญาต') ||
            ariaLabel.includes('อนุญาต') ||
            ariaLabel.includes('Allow')) {
            btn.click();
            return { success: true, text };
          }
        }

        // Also check for dialog with notification permission
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const dialog of dialogs) {
          const dialogText = dialog.textContent || '';
          if (dialogText.includes('แสดงการแจ้งเตือน') ||
            dialogText.includes('notification') ||
            dialogText.includes('แจ้งเตือน')) {
            const allowBtn = dialog.querySelector('button, [role="button"]');
            if (allowBtn) {
              const btnText = allowBtn.textContent?.trim() || '';
              if (btnText === 'อนุญาต' || btnText === 'Allow') {
                allowBtn.click();
                return { success: true, text: btnText, method: 'dialog' };
              }
            }
          }
        }

        return { success: false };
      });

      if (clicked.success) {
        console.log(`✅ Clicked notification permission: "${clicked.text}"`);
        await this.delay(1000);
      } else {
        console.log('ℹ️ No notification dialog found (may already be set)');
      }

      return clicked.success;
    } catch (error) {
      console.log('ℹ️ Notification permission check skipped:', error.message);
      return false;
    }
  }

  // Generate caption using Claude API
  async generateCaption(property, style = 'friendly') {
    if (!this.anthropic) {
      // Fallback to template-based caption
      return this.generateTemplateCaption(property, style);
    }

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
- สิ่งอำนวยความสะดวก: ${property.amenities?.join(', ') || 'ไม่ระบุ'}
- รายละเอียด: ${property.description || 'ไม่ระบุ'}
- ติดต่อ: ${property.contactPhone}
${property.contactLine ? `- LINE: ${property.contactLine}` : ''}

สไตล์: ${style === 'friendly' ? 'เป็นกันเอง ใช้ emoji' : style === 'professional' ? 'มืออาชีพ เป็นทางการ' : 'สบายๆ ไม่เป็นทางการ'}

กติกา:
- ใช้ภาษาไทยที่อ่านง่าย กระชับ
- ใส่ emoji ให้ดูน่าสนใจ (ถ้าสไตล์เหมาะสม)
- ความยาวไม่เกิน 250 คำ
- ใส่ hashtag ที่เกี่ยวข้อง 3-5 อัน
- ห้ามคัดลอกคำซ้ำจาก prompt โดยตรง ให้เรียบเรียงใหม่`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error.message);
      return this.generateTemplateCaption(property, style);
    }
  }

  // Fallback template-based caption
  generateTemplateCaption(property, style) {
    const priceFormatted = new Intl.NumberFormat('th-TH').format(property.price);
    const isRent = property.listingType === 'rent';

    const templates = {
      friendly: `🏠 มาแล้วค่ะ! ${property.title}

💰 ${isRent ? 'เช่า' : 'ขาย'}เพียง ${priceFormatted} บาท${isRent ? '/เดือน' : ''}
📍 ${property.location}, ${property.district}
🛏️ ${property.bedrooms} ห้องนอน | 🚿 ${property.bathrooms} ห้องน้ำ
📐 ${property.size} ตร.ม.

${property.amenities?.slice(0, 4).map(a => `✅ ${a}`).join('\n') || ''}

📞 ติดต่อ: ${property.contactPhone}
${property.contactLine ? `💬 LINE: ${property.contactLine}` : ''}

#อสังหาริมทรัพย์ #${property.district} #${isRent ? 'ให้เช่า' : 'ขาย'}`,

      professional: `📢 ${isRent ? 'ให้เช่า' : 'ขาย'}: ${property.title}

📍 ทำเลที่ตั้ง: ${property.location}, ${property.district}, ${property.province}
💵 ราคา: ${priceFormatted} บาท${isRent ? '/เดือน' : ''}

🏢 รายละเอียด:
• ประเภท: ${property.type}
• พื้นที่: ${property.size} ตร.ม.
• ห้องนอน: ${property.bedrooms}
• ห้องน้ำ: ${property.bathrooms}

🎯 สิ่งอำนวยความสะดวก:
${property.amenities?.map(a => `• ${a}`).join('\n') || '• -'}

📲 ติดต่อสอบถาม:
☎️ ${property.contactPhone}
${property.contactLine ? `LINE: ${property.contactLine}` : ''}`,

      casual: `ใครหาที่อยู่อยู่บ้าง 👀

${property.title} ${isRent ? 'ให้เช่า' : 'ขาย'}
แค่ ${priceFormatted} ${isRent ? 'บาท/เดือน' : 'บาท'}!

📍 ${property.location}
🛏️ ${property.bedrooms} นอน ${property.bathrooms} น้ำ
📐 ${property.size} ตร.ม.

มี ${property.amenities?.slice(0, 3).join(', ') || 'สิ่งอำนวยความสะดวก'} ครบ!

สนใจทัก ${property.contactPhone} ได้เลยนะ 💬`
    };

    return templates[style] || templates.friendly;
  }

  // Navigate to a Facebook group
  async navigateToGroup(groupUrl) {
    console.log(`🔄 Navigating to group: ${groupUrl}`);

    try {
      await this.page.goto(groupUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.delay(3000);

      // Check if we're on a group page
      const isGroupPage = await this.page.evaluate(() => {
        return window.location.href.includes('/groups/');
      });

      if (!isGroupPage) {
        throw new Error('Not a valid group page');
      }

      console.log('✅ Navigated to group');
      return true;
    } catch (error) {
      console.error('Navigation error:', error.message);
      return false;
    }
  }

  // Click on "Write something" or create post button
  async openPostComposer() {
    console.log('🔄 Opening post composer...');

    try {
      // Try various methods to open the post composer
      const opened = await this.page.evaluate(() => {
        // Method 1: Click on "เขียนอะไรสักหน่อย" or "Write something"
        const writeButtons = document.querySelectorAll('[role="button"]');
        for (const btn of writeButtons) {
          const text = btn.textContent || '';
          if (text.includes('เขียนอะไรสักหน่อย') ||
            text.includes('Write something') ||
            text.includes('สร้างโพสต์') ||
            text.includes('Create post')) {
            btn.click();
            return { success: true, method: 'write-button' };
          }
        }

        // Method 2: Click on the composer area
        const composerSelectors = [
          '[data-pagelet="GroupInlineComposer"]',
          '[aria-label="สร้างโพสต์สาธารณะ"]',
          '[aria-label="Create a public post"]',
        ];

        for (const selector of composerSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            el.click();
            return { success: true, method: 'composer-click' };
          }
        }

        // Method 3: Look for any clickable post input area
        const inputs = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
        for (const input of inputs) {
          if (input.closest('[data-pagelet]') || input.closest('[role="dialog"]')) {
            input.click();
            return { success: true, method: 'input-click' };
          }
        }

        return { success: false };
      });

      console.log('Post composer result:', opened);
      await this.delay(2000);

      return opened.success;
    } catch (error) {
      console.error('Open composer error:', error.message);
      return false;
    }
  }

  // Upload images to the post
  async uploadImagesToPost(images) {
    console.log('=== uploadImagesToPost called ===');
    console.log('Images param:', images);
    console.log('Images type:', typeof images);
    console.log('Is array:', Array.isArray(images));

    if (!images || images.length === 0) {
      console.log('❌ No images to upload - images is empty or undefined');
      return true;
    }

    console.log(`🔄 Uploading ${images.length} images...`);

    try {
      // First, save all base64 images to temp files
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filePaths = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];

        if (image.startsWith('data:')) {
          // Base64 image - save to temp file
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          const filePath = path.join(tempDir, `img_${Date.now()}_${i}.jpg`);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          filePaths.push(filePath);
          console.log(`📁 Saved temp image: ${filePath}`);
        } else if (image.startsWith('http')) {
          // URL image - download first using fetch (ESM compatible)
          console.log(`🌐 Downloading image from URL: ${image}`);
          try {
            const response = await fetch(image);
            const buffer = Buffer.from(await response.arrayBuffer());
            const filePath = path.join(tempDir, `img_${Date.now()}_${i}.jpg`);
            fs.writeFileSync(filePath, buffer);
            filePaths.push(filePath);
            console.log(`📁 Downloaded image: ${filePath}`);
          } catch (downloadError) {
            console.log(`⚠️ Failed to download: ${image}`);
          }
        } else if (fs.existsSync(image)) {
          // Local file path
          filePaths.push(image);
        }
      }

      if (filePaths.length === 0) {
        console.log('⚠️ No valid images to upload');
        return false;
      }

      console.log(`📁 Prepared ${filePaths.length} temp files for upload:`);
      filePaths.forEach((fp, i) => console.log(`   ${i + 1}. ${fp}`));

      // CRITICAL: Set up fileChooser listener BEFORE clicking any button
      // This intercepts the file dialog before it opens
      console.log('📤 Setting up file chooser listener FIRST...');

      try {
        // Start listening for file chooser BEFORE triggering
        const fileChooserPromise = this.page.waitForFileChooser({ timeout: 10000 });

        // Now click the photo button to trigger file chooser
        console.log('🔍 Clicking photo/video button...');

        await this.page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return false;

          // Look for photo/video button - try multiple selectors
          const selectors = [
            '[aria-label*="รูปภาพ"]',
            '[aria-label*="Photo"]',
            '[aria-label*="photo"]',
            '[aria-label*="วิดีโอ"]',
            '[aria-label*="Video"]'
          ];

          for (const selector of selectors) {
            const btn = dialog.querySelector(selector);
            if (btn) {
              btn.click();
              return true;
            }
          }

          // Try finding by text content
          const buttons = dialog.querySelectorAll('[role="button"]');
          for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (text.includes('รูปภาพ') || text.includes('photo') ||
              label.includes('รูปภาพ') || label.includes('photo')) {
              btn.click();
              return true;
            }
          }

          return false;
        });

        // Wait for the file chooser we set up earlier
        console.log('⏳ Waiting for file chooser...');
        const fileChooser = await fileChooserPromise;

        console.log('✅ File chooser intercepted!');
        await fileChooser.accept(filePaths);
        console.log('✅ Files sent to chooser - no dialog should appear');

      } catch (chooserError) {
        console.log('⚠️ FileChooser failed:', chooserError.message);
        console.log('🔄 Trying direct input method...');

        // Fallback: Direct input method
        const fileInputs = await this.page.$$('input[type="file"]');
        console.log(`Found ${fileInputs.length} file inputs`);

        if (fileInputs.length > 0) {
          const fileInput = fileInputs[fileInputs.length - 1];
          await fileInput.uploadFile(...filePaths);
          console.log('✅ Files uploaded via direct input');
        } else {
          console.log('❌ No file inputs found');
          return false;
        }
      }

      // Wait for images to upload and show preview
      console.log('⏳ Waiting for images to process...');
      await this.delay(5000);

      // Verify images were uploaded
      const hasImages = await this.page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const images = dialog.querySelectorAll('img[src*="blob:"], img[src*="scontent"]');
        return images.length > 0;
      });

      console.log(`🖼️ Images visible in preview: ${hasImages}`);

      // Clean up temp files after delay
      setTimeout(() => {
        for (const fp of filePaths) {
          if (fp.includes('temp')) {
            try { fs.unlinkSync(fp); } catch (e) { }
          }
        }
      }, 60000);

      console.log('✅ Image upload process completed');
      return true;
    } catch (error) {
      console.error('Upload images error:', error.message);
      return false;
    }
  }

  // ============================================
  // HUMAN-LIKE CAPTION INPUT
  // Randomly chooses: type char-by-char OR paste via clipboard
  // Mimics real behavior — sometimes people type, sometimes paste a pre-written caption
  // ============================================
  async humanLikeCaptionInput(page, caption) {
    // ~45% type, ~55% paste (people paste captions more often than typing them out)
    const useTyping = Math.random() < 0.45;
    console.log(`📝 Caption method: ${useTyping ? '⌨️ พิมพ์ทีละตัว (human typing)' : '📋 วางแคปชั่น (clipboard paste)'}`);

    // Step 1: Find and focus the correct text editor in the post dialog
    const focusResult = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      let postDialog = null;
      for (const dialog of dialogs) {
        const dt = dialog.textContent || '';
        if (dt.includes('สร้างโพสต์') || dt.includes('Create post') || dt.includes('Create Post')) {
          postDialog = dialog;
          break;
        }
      }
      if (!postDialog) postDialog = document.querySelector('[role="dialog"]');
      if (!postDialog) return { success: false, error: 'No dialog found' };

      const textboxes = postDialog.querySelectorAll('[contenteditable="true"][role="textbox"]');
      for (const editor of textboxes) {
        const ariaLabel = editor.getAttribute('aria-label') || '';
        if (ariaLabel.includes('แสดงความคิดเห็น') || ariaLabel.includes('comment')) continue;
        editor.focus();
        editor.innerHTML = '';
        return { success: true, method: 'dialog-textbox' };
      }
      const anyTb = postDialog.querySelector('[role="textbox"]');
      if (anyTb) {
        anyTb.focus();
        anyTb.innerHTML = '';
        return { success: true, method: 'fallback' };
      }
      return { success: false, error: 'No textbox in dialog' };
    });

    if (!focusResult.success) {
      console.log(`❌ Focus failed: ${focusResult.error}`);
      return false;
    }

    // Step 2: Input the caption using the chosen method
    if (useTyping) {
      // ── TYPING MODE: Character by character with random delays ──
      // Mimics human typing: 25-70ms per char + occasional thinking pauses
      const pauseEvery = 15 + Math.floor(Math.random() * 25); // Pause every 15-40 chars
      let charCount = 0;

      for (const char of caption) {
        if (char === '\n') {
          await page.keyboard.press('Enter');
        } else {
          await page.keyboard.sendCharacter(char);
        }

        charCount++;

        // Random delay between characters (25-70ms) — realistic typing speed
        const charDelay = 25 + Math.floor(Math.random() * 45);
        await this.delay(charDelay);

        // Occasional thinking pause every 15-40 chars (200-800ms)
        if (charCount % pauseEvery === 0) {
          const thinkPause = 200 + Math.floor(Math.random() * 600);
          await this.delay(thinkPause);
        }
      }

      const estimatedTime = (caption.length * 47 / 1000).toFixed(1);
      console.log(`⌨️ Typed ${caption.length} chars (~${estimatedTime}s)`);

    } else {
      // ── PASTE MODE: Insert all text at once (like copy-paste) ──
      // Small pre-paste delay (human switching from copy to paste)
      await this.delay(200 + Math.floor(Math.random() * 300));

      const pasted = await page.evaluate((text) => {
        const editor = document.activeElement;
        if (editor && (editor.getAttribute('contenteditable') === 'true' || editor.getAttribute('role') === 'textbox')) {
          document.execCommand('insertText', false, text);
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        // Fallback: find editor in dialog again
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const tb = dialog.querySelector('[contenteditable="true"][role="textbox"]');
          if (tb) {
            tb.focus();
            document.execCommand('insertText', false, text);
            tb.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, caption);

      if (!pasted) {
        console.log('⚠️ Paste fallback failed, retrying with execCommand...');
        // Last resort: re-focus and insert
        await page.evaluate((text) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return;
          const textboxes = dialog.querySelectorAll('[contenteditable="true"][role="textbox"]');
          for (const editor of textboxes) {
            const ariaLabel = editor.getAttribute('aria-label') || '';
            if (ariaLabel.includes('แสดงความคิดเห็น') || ariaLabel.includes('comment')) continue;
            editor.focus();
            document.execCommand('insertText', false, text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
        }, caption);
      }

      console.log(`📋 Pasted ${caption.length} chars`);
    }

    // Final: ensure Facebook registers the content
    await page.evaluate(() => {
      const editor = document.activeElement;
      if (editor && (editor.getAttribute('contenteditable') === 'true' || editor.getAttribute('role') === 'textbox')) {
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    return true;
  }

  // Type caption into post (legacy — calls humanLikeCaptionInput)
  async typeCaption(caption) {
    console.log('🔄 Typing caption...');
    try {
      const success = await this.humanLikeCaptionInput(this.page, caption);
      await this.delay(500);
      return success;
    } catch (error) {
      console.error('Type caption error:', error.message);
      return false;
    }
  }

  // Submit the post
  async submitPost() {
    console.log('🔄 Submitting post...');

    try {
      // Wait a bit for the post button to become enabled
      await this.delay(2000);

      const submitted = await this.page.evaluate(() => {
        // Find the Create Post dialog first
        const dialogs = document.querySelectorAll('[role="dialog"]');
        let postDialog = null;

        for (const dialog of dialogs) {
          const dialogText = dialog.textContent || '';
          if (dialogText.includes('สร้างโพสต์') ||
            dialogText.includes('Create post') ||
            dialogText.includes('Create Post')) {
            postDialog = dialog;
            break;
          }
        }

        if (!postDialog) {
          postDialog = document.querySelector('[role="dialog"]');
        }

        if (!postDialog) {
          return { success: false, error: 'No dialog found' };
        }

        // Find the Post button inside the dialog
        const buttons = postDialog.querySelectorAll('[role="button"], button');

        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';

          // Check if this is the Post button
          if (text === 'โพสต์' ||
            text === 'Post' ||
            ariaLabel === 'โพสต์' ||
            ariaLabel === 'Post') {

            // Check if button is enabled
            const isDisabled = btn.hasAttribute('aria-disabled') && btn.getAttribute('aria-disabled') === 'true';
            const isActuallyDisabled = btn.disabled === true;

            if (!isDisabled && !isActuallyDisabled) {
              btn.click();
              return { success: true, text, method: 'dialog-button' };
            } else {
              return { success: false, error: 'Post button is disabled', text };
            }
          }
        }

        // Fallback: find any button with โพสต์ text on the page
        const allButtons = document.querySelectorAll('[role="button"], button');
        for (const btn of allButtons) {
          const text = btn.textContent?.trim() || '';
          if (text === 'โพสต์' || text === 'Post') {
            const isDisabled = btn.hasAttribute('aria-disabled') && btn.getAttribute('aria-disabled') === 'true';
            if (!isDisabled) {
              btn.click();
              return { success: true, text, method: 'fallback' };
            }
          }
        }

        return { success: false, error: 'Post button not found' };
      });

      console.log('Submit result:', submitted);

      if (submitted.success) {
        // Wait for post to be submitted
        await this.delay(5000);
        console.log('✅ Post submitted');
        return true;
      } else {
        console.log('⚠️ Submit failed:', submitted.error);
      }

      return false;
    } catch (error) {
      console.error('Submit post error:', error.message);
      return false;
    }
  }

  // Get the post URL after submission
  async getLatestPostUrl() {
    try {
      // Try to get the URL from the notification or redirect
      const url = await this.page.url();

      if (url.includes('/posts/') || url.includes('/permalink/')) {
        return url;
      }

      // Try to find the latest post link
      const postUrl = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]');
        if (links.length > 0) {
          return links[0].href;
        }
        return null;
      });

      return postUrl;
    } catch (error) {
      return null;
    }
  }

  // Main function to post to a single group (legacy — uses this.page)
  async postToGroup(groupUrl, property, caption, images) {
    return this.postToGroupOnTab(this.page, groupUrl, property, caption, images);
  }

  // Post to a single group on a SPECIFIC tab (supports multi-tab)
  // Robust version: reads actual group name → verifies vs task progress → then posts
  // preparedFilePaths = pre-prepared temp image files (pass [] if no images)
  async postToGroupOnTab(page, groupUrl, property, caption, images, taskGroupName = '', preparedFilePaths = null, task = null) {
    console.log(`\n📤 Posting to group: ${groupUrl}`);
    console.log(`📋 Task expects group: "${taskGroupName}"`);

    try {
      // ── Step 1: ALWAYS navigate to the group URL ──
      console.log(`🔄 Navigating to group: ${groupUrl}`);
      await page.goto(groupUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.delay(2000);

      // ── Step 1.2: AGGRESSIVELY dismiss Notifications overlay ──
      // Facebook Notifications panel is [role="dialog"] and blocks everything
      console.log('🔕 Dismissing overlays...');
      const hasNotifDialog = () => page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          const text = (d.textContent || '').toLowerCase();
          if (text.includes('notification') || text.includes('การแจ้งเตือน') || text.includes('unread') || text.includes('push notification')) return true;
        }
        return false;
      });
      for (let dismissAttempt = 0; dismissAttempt < 3; dismissAttempt++) {
        if (!(await hasNotifDialog())) { console.log(`   ✅ No Notifications overlay`); break; }
        console.log(`   🔕 Notifications overlay detected — closing (attempt ${dismissAttempt + 1})...`);
        try {
          await page.keyboard.press('Escape');
          await this.delay(300);
          await page.evaluate(() => {
            document.querySelectorAll('[aria-label="Close"], [aria-label="ปิด"]').forEach(b => { if (b.getBoundingClientRect().width > 0) b.click(); });
          });
          await this.delay(300);
          await page.evaluate(() => { const m = document.querySelector('[role="main"]'); if (m) m.click(); });
          await this.delay(300);
        } catch (e) { /* ignore */ }
      }
      // NUCLEAR OPTION: if Notifications STILL open, reload the page to kill all overlays
      if (await hasNotifDialog()) {
        console.log('   ☢️ Notifications won\'t close — reloading page...');
        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
        await this.delay(3000);
        // One more check after reload
        if (await hasNotifDialog()) {
          console.log('   ☢️ Still there after reload — navigating directly...');
          await page.goto(groupUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          await this.delay(3000);
        }
        console.log('   ✅ Page reloaded — overlays cleared');
      }

      // ── Step 1.5: READ group name — use document.title (more reliable than h1) ──
      console.log('📖 Reading actual group name from page...');
      const actualGroupName = await page.evaluate(() => {
        // Priority 1: document.title — "GroupName | Facebook" (never polluted by overlays)
        const title = document.title || '';
        if (title && !title.startsWith('Facebook') && !title.toLowerCase().includes('notification')) {
          return title.replace(/\s*[|–-]\s*Facebook.*$/i, '').trim();
        }
        // Priority 2: og:title meta tag
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
          return ogTitle.getAttribute('content')?.trim() || '';
        }
        // Priority 3: h1 in [role="main"] only (skip overlay h1s)
        const mainH1 = document.querySelector('[role="main"] h1');
        if (mainH1 && mainH1.textContent?.trim().length > 2) {
          return mainH1.textContent.trim();
        }
        // Priority 4: any h1
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent?.trim().length > 2) {
          return h1.textContent.trim();
        }
        return '';
      });

      const currentUrl = await page.url();
      console.log(`📖 ชื่อกลุ่มจริงจากหน้าเว็บ: "${actualGroupName}"`);
      console.log(`📖 Current URL: ${currentUrl}`);
      console.log(`📋 ชื่อกลุ่มใน Task Progress: "${taskGroupName}"`);

      // ── Verify name matches task progress ──
      if (taskGroupName && actualGroupName) {
        const normActual = (actualGroupName || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const normTask = (taskGroupName || '').replace(/\s+/g, ' ').trim().toLowerCase();

        const isMatch = normActual === normTask ||
          normActual.includes(normTask) ||
          normTask.includes(normActual) ||
          this.fuzzyGroupNameMatch(normTask, normActual);

        if (isMatch) {
          console.log(`✅ ชื่อตรงกัน — ยืนยันกลุ่มถูกต้อง`);
        } else {
          console.log(`⚠️ ชื่อไม่ตรง! Task="${taskGroupName}" vs Page="${actualGroupName}"`);
          console.log(`   → ดำเนินการโพสต์ต่อ (URL ถูกต้อง)`);
        }
      }

      // ── Check if this is a Buy/Sell group (ซื้อและขาย) ──
      // These groups only have "ขายสินค้า" button, no normal post composer
      let isBuySellGroup = await page.evaluate(() => {
        const allBtns = document.querySelectorAll('[role="button"]');
        let hasSellBtn = false;
        let hasWriteBtn = false;
        for (const b of allBtns) {
          const t = b.textContent?.trim()?.toLowerCase() || '';
          if (t.includes('ขายสินค้า') || t.includes('sell something') || t.includes('sell') ||
            t.includes('create listing') || t.includes('สร้างรายการ') || t.includes('list item')) hasSellBtn = true;
          if (t.includes('เขียนอะไรสักหน่อย') || t.includes('write something') ||
            t.includes('สร้างโพสต์') || t.includes('create post')) hasWriteBtn = true;
        }
        const tabs = document.querySelectorAll('[role="tab"], a[role="link"]');
        let hasBuySellTab = false;
        for (const tab of tabs) {
          const t = tab.textContent?.trim()?.toLowerCase() || '';
          if (t.includes('ซื้อและขาย') || t.includes('buy and sell') || t.includes('marketplace')) hasBuySellTab = true;
        }
        return { hasSellBtn, hasWriteBtn, hasBuySellTab };
      });

      console.log(`   🔍 Group type: sellBtn=${isBuySellGroup.hasSellBtn}, writeBtn=${isBuySellGroup.hasWriteBtn}, buySellTab=${isBuySellGroup.hasBuySellTab}`);

      // Debug: dump all button texts on page to find the right one
      if (!isBuySellGroup.hasSellBtn && !isBuySellGroup.hasWriteBtn) {
        const allBtnTexts = await page.evaluate(() => {
          const btns = document.querySelectorAll('[role="button"]');
          const texts = [];
          for (const b of btns) {
            const t = b.textContent?.trim() || '';
            if (t.length > 1 && t.length < 50) texts.push(t);
          }
          return [...new Set(texts)].slice(0, 20);
        });
        console.log(`   🔍 All buttons on page:`, JSON.stringify(allBtnTexts));
      }

      // If buy/sell tab exists but sell button not found, click the tab first
      if (isBuySellGroup.hasBuySellTab && !isBuySellGroup.hasSellBtn && !isBuySellGroup.hasWriteBtn) {
        console.log('🛒 พบ tab ซื้อขาย แต่ไม่เจอปุ่ม — กำลังกดเข้า tab...');
        await page.evaluate(() => {
          const tabs = document.querySelectorAll('[role="tab"], a[role="link"]');
          for (const tab of tabs) {
            const t = tab.textContent?.trim()?.toLowerCase() || '';
            if (t.includes('ซื้อและขาย') || t.includes('buy and sell')) {
              tab.click();
              return true;
            }
          }
          return false;
        });
        await this.delay(3000);

        // Re-check for sell/write buttons after clicking tab
        isBuySellGroup = await page.evaluate(() => {
          const allBtns = document.querySelectorAll('[role="button"]');
          let hasSellBtn = false;
          let hasWriteBtn = false;
          for (const b of allBtns) {
            const t = b.textContent?.trim()?.toLowerCase() || '';
            if (t.includes('ขายสินค้า') || t.includes('sell something') || t.includes('sell') ||
              t.includes('create listing') || t.includes('สร้างรายการ') || t.includes('list item')) hasSellBtn = true;
            if (t.includes('เขียนอะไรสักหน่อย') || t.includes('write something') ||
              t.includes('สร้างโพสต์') || t.includes('create post')) hasWriteBtn = true;
          }
          return { hasSellBtn, hasWriteBtn, hasBuySellTab: true };
        });
        console.log(`   🔍 After tab click: sellBtn=${isBuySellGroup.hasSellBtn}, writeBtn=${isBuySellGroup.hasWriteBtn}`);
      }

      if (isBuySellGroup.hasSellBtn && !isBuySellGroup.hasWriteBtn) {
        console.log(`🛒 กลุ่มซื้อขาย — ใช้ flow ขายสินค้า: ${actualGroupName || groupUrl}`);
        const buySellResult = await this.postBuySellListing(page, property, caption, preparedFilePaths, task);
        buySellResult.actualGroupName = actualGroupName;
        return buySellResult;
      }

      // Wait until Facebook SPA renders the group feed (composer area appears)
      // If composer never appears → this group doesn't allow posting
      console.log('⏳ Waiting for composer to appear...');
      let hasComposer = false;
      try {
        await page.waitForFunction(() => {
          const btns = document.querySelectorAll('[role="button"]');
          for (const b of btns) {
            const t = b.textContent || '';
            if (t.includes('เขียนอะไรสักหน่อย') || t.includes('Write something') ||
              t.includes('สร้างโพสต์') || t.includes('Create post')) return true;
          }
          return false;
        }, { timeout: 10000 });
        hasComposer = true;
      } catch (e) {
        hasComposer = false;
      }

      if (!hasComposer) {
        console.log(`🚫 ไม่พบช่องโพสต์: ${actualGroupName || groupUrl}`);
        return { success: false, error: 'ไม่พบช่องเขียนโพสต์', actualGroupName };
      }

      // ── Step 2: Open post composer (with retry) ──
      console.log('🔄 Opening post composer...');
      let composerOpened = false;
      for (let attempt = 0; attempt < 3 && !composerOpened; attempt++) {
        if (attempt > 0) {
          console.log(`   🔁 Retry ${attempt}/2...`);
          await this.delay(2000);
        }
        composerOpened = await page.evaluate(() => {
          const writeButtons = document.querySelectorAll('[role="button"]');
          for (const btn of writeButtons) {
            const text = btn.textContent || '';
            if (text.includes('เขียนอะไรสักหน่อย') || text.includes('Write something') ||
              text.includes('สร้างโพสต์') || text.includes('Create post')) {
              btn.click();
              return true;
            }
          }
          const composerSelectors = [
            '[data-pagelet="GroupInlineComposer"]',
            '[aria-label="สร้างโพสต์สาธารณะ"]',
            '[aria-label="Create a public post"]',
          ];
          for (const sel of composerSelectors) {
            const el = document.querySelector(sel);
            if (el) { el.click(); return true; }
          }
          const inputs = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
          for (const input of inputs) {
            if (input.closest('[data-pagelet]') || input.closest('[role="main"]')) {
              input.click();
              return true;
            }
          }
          return false;
        });
      }
      if (!composerOpened) {
        console.log('🚫 กดเปิดช่องโพสต์ไม่ได้ — ข้ามกลุ่มนี้');
        return { success: false, error: 'ไม่สามารถเปิดช่องเขียนโพสต์ได้' };
      }

      // Wait for dialog to actually appear in DOM
      console.log('⏳ Waiting for post dialog...');
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      await this.delay(1000);

      // ── Step 3: Upload images ──
      if (preparedFilePaths && preparedFilePaths.length > 0) {
        // Use pre-prepared file paths (parallel-safe)
        await this.uploadPreparedImages(page, preparedFilePaths);
        await this.delay(1500);
      } else if (images && images.length > 0) {
        // Fallback: prepare + upload (single-tab mode)
        await this.uploadImagesToPostOnTab(page, images);
        await this.delay(1500);
      }

      // ── Step 4: Type caption (human-like: randomly type or paste) ──
      console.log('🔄 Entering caption...');
      let typed = false;
      for (let attempt = 0; attempt < 3 && !typed; attempt++) {
        if (attempt > 0) {
          console.log(`   🔁 Caption retry ${attempt}/2...`);
          await this.delay(1000);
        }
        typed = await this.humanLikeCaptionInput(page, caption);
      }
      if (!typed) throw new Error('Failed to type caption after 3 attempts');
      await this.delay(1000);

      // ── Step 5: Submit post (wait for button to be enabled, then click) ──
      // Random human-like pause before submitting (1-3s) — ดูเหมือนคนอ่านทบทวนก่อนกดโพสต์
      const preSubmitDelay = 1000 + Math.floor(Math.random() * 2000);
      console.log(`⏱️ Pre-submit pause: ${(preSubmitDelay / 1000).toFixed(1)}s`);
      await this.delay(preSubmitDelay);
      console.log('🔄 Submitting post...');
      // Wait for Post button to become enabled
      let submitted = false;
      for (let attempt = 0; attempt < 5 && !submitted; attempt++) {
        if (attempt > 0) await this.delay(1000);
        submitted = await page.evaluate(() => {
          const dialogs = document.querySelectorAll('[role="dialog"]');
          let postDialog = null;
          for (const dialog of dialogs) {
            const dt = dialog.textContent || '';
            if (dt.includes('สร้างโพสต์') || dt.includes('Create post') || dt.includes('Create Post')) {
              postDialog = dialog;
              break;
            }
          }
          if (!postDialog) postDialog = document.querySelector('[role="dialog"]');
          if (!postDialog) return false;

          const buttons = postDialog.querySelectorAll('[role="button"], button');
          for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            if (text === 'โพสต์' || text === 'Post' || ariaLabel === 'โพสต์' || ariaLabel === 'Post') {
              const isDisabled = (btn.getAttribute('aria-disabled') === 'true') || btn.disabled;
              if (!isDisabled) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        });
        if (!submitted && attempt < 4) {
          console.log(`   ⏳ Post button not ready, waiting... (${attempt + 1}/5)`);
        }
      }
      if (!submitted) throw new Error('Failed to submit — Post button disabled or not found');

      // Wait for dialog to close (= post submitted successfully)
      console.log('⏳ Waiting for post to submit...');
      await page.waitForFunction(() => {
        return !document.querySelector('[role="dialog"]');
      }, { timeout: 15000 }).catch(() => {
        console.log('⚠️ Dialog still visible after 15s — post may still be processing');
      });
      await this.delay(1000);

      // ── Step 6: Get post URL ──
      const postUrl = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]');
        return links.length > 0 ? links[0].href : null;
      });

      console.log(`✅ Successfully posted to group: ${actualGroupName || groupUrl}`);
      return { success: true, postUrl, actualGroupName };

    } catch (error) {
      console.error(`❌ Failed to post to group: ${error.message}`);
      // Screenshot on failure for debugging
      try {
        const ssPath = path.join(process.cwd(), 'temp', `fail_${Date.now()}.png`);
        if (!fs.existsSync(path.join(process.cwd(), 'temp'))) fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true });
        await page.screenshot({ path: ssPath, fullPage: false });
        console.log(`📸 Failure screenshot: ${ssPath}`);
      } catch (ssErr) { /* ignore */ }
      return { success: false, error: error.message };
    }
  }

  // Prepare image files ONCE — converts base64/URLs to temp files
  // Call this once before parallel batch, then pass filePaths to each tab
  async prepareImageFiles(images) {
    if (!images || images.length === 0) return [];

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePaths = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (image.startsWith('data:')) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const filePath = path.join(tempDir, `img_shared_${Date.now()}_${i}.jpg`);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        filePaths.push(filePath);
      } else if (image.startsWith('http')) {
        try {
          const response = await fetch(image);
          const buffer = Buffer.from(await response.arrayBuffer());
          const filePath = path.join(tempDir, `img_shared_${Date.now()}_${i}.jpg`);
          fs.writeFileSync(filePath, buffer);
          filePaths.push(filePath);
        } catch (e) { console.log(`⚠️ Failed to download: ${image}`); }
      } else if (fs.existsSync(image)) {
        filePaths.push(image);
      }
    }

    if (filePaths.length > 0) {
      console.log(`🖼️ Prepared ${filePaths.length} image files for batch upload`);
      // Cleanup shared temp files after 5 minutes
      setTimeout(() => { for (const fp of filePaths) { if (fp.includes('temp')) { try { fs.unlinkSync(fp); } catch (e) { } } } }, 300000);
    }
    return filePaths;
  }

  // Upload pre-prepared image files on a specific tab (safe for parallel use)
  async uploadPreparedImages(page, filePaths) {
    if (!filePaths || filePaths.length === 0) return true;
    console.log(`🔄 Uploading ${filePaths.length} images on tab...`);

    try {
      try {
        const fileChooserPromise = page.waitForFileChooser({ timeout: 10000 });
        await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return;
          const selectors = ['[aria-label*="รูปภาพ"]', '[aria-label*="Photo"]', '[aria-label*="photo"]'];
          for (const sel of selectors) { const btn = dialog.querySelector(sel); if (btn) { btn.click(); return; } }
          const buttons = dialog.querySelectorAll('[role="button"]');
          for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase();
            if (text.includes('รูปภาพ') || text.includes('photo')) { btn.click(); return; }
          }
        });
        const fileChooser = await fileChooserPromise;
        await fileChooser.accept(filePaths);
      } catch (e) {
        const fileInputs = await page.$$('input[type="file"]');
        if (fileInputs.length > 0) await fileInputs[fileInputs.length - 1].uploadFile(...filePaths);
      }
      await this.delay(3000);
      return true;
    } catch (error) {
      console.error('Upload images error:', error.message);
      return false;
    }
  }

  // Legacy wrapper (for single-tab mode)
  async uploadImagesToPostOnTab(page, images) {
    const filePaths = await this.prepareImageFiles(images);
    return this.uploadPreparedImages(page, filePaths);
  }

  // ============================================
  // CHECKPOINT / CAPTCHA DETECTION
  // ============================================
  async detectCheckpoint(page) {
    try {
      const targetPage = page || this.page;
      if (!targetPage) return { detected: false };

      const result = await targetPage.evaluate(() => {
        const url = window.location.href;
        const bodyText = document.body?.innerText || '';

        // Check URL patterns
        if (url.includes('/checkpoint') || url.includes('/login/identify') || url.includes('/recover')) {
          return { detected: true, type: 'checkpoint', reason: 'checkpoint URL detected' };
        }

        // Check for captcha / verification
        if (bodyText.includes('ยืนยันตัวตน') || bodyText.includes('Verify your identity') ||
          bodyText.includes('กรุณายืนยัน') || bodyText.includes('security check') ||
          bodyText.includes('Enter the code') || bodyText.includes('ใส่รหัส')) {
          return { detected: true, type: 'captcha', reason: 'captcha/verification prompt' };
        }

        // Check for temporary block / restriction
        if (bodyText.includes('ถูกจำกัด') || bodyText.includes('restricted') ||
          bodyText.includes('ถูกบล็อก') || bodyText.includes('temporarily blocked') ||
          bodyText.includes('ลองอีกครั้งในภายหลัง') || bodyText.includes('try again later') ||
          bodyText.includes('ไม่สามารถโพสต์ได้') || bodyText.includes("can't post")) {
          return { detected: true, type: 'blocked', reason: 'account temporarily blocked/restricted' };
        }

        // Check for rate limit
        if (bodyText.includes('โพสต์เร็วเกินไป') || bodyText.includes('posting too fast') ||
          bodyText.includes('รอสักครู่') || bodyText.includes('slow down') ||
          bodyText.includes('You\'re posting too fast')) {
          return { detected: true, type: 'rate_limit', reason: 'posting too fast' };
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

  // Dynamic batch size based on total group count — mimics human behavior
  // Fewer groups = smaller batches (cautious), more groups = larger batches (confident)
  getRandomBatchSize(totalGroups) {
    let min, max;
    if (totalGroups <= 10) {
      min = 1; max = 4;
    } else if (totalGroups <= 30) {
      min = 3; max = 6;
    } else if (totalGroups <= 50) {
      min = 4; max = 7;
    } else {
      min = 6; max = 10;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Start automation for multiple groups — dynamic batch sizes, posts in parallel
  async startAutomation(config) {
    const { property, groups, caption, captions, captionAssignments, images, delayMinutes, delaySeconds, captionStyle = 'friendly', browser = 'chrome', userPackage = 'free' } = config;

    // Reset if stuck in running state
    if (this.isRunning) {
      console.log('⚠️ Previous automation was stuck, resetting...');
      this.isRunning = false;
      this.isPaused = false;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.totalSteps = groups.length;
    this.currentStep = 0;

    // Reset log buffer and set start time
    this.logs = [];
    this.startTime = Date.now();
    this.endTime = null;
    this.generatedCaptions = Array.isArray(captions) && captions.length > 0
      ? captions
      : (caption ? [caption] : []);

    // Initialize tasks
    this.tasks = groups.map((group, index) => ({
      id: `task-${index}`,
      groupId: group.id,
      groupName: group.name,
      groupUrl: group.url,
      status: 'pending',
      message: '',
      postUrl: null,
    }));

    // Determine delay: use delaySeconds if provided, otherwise fall back to delayMinutes
    const useSeconds = typeof delaySeconds === 'number' && delaySeconds > 0;
    const batchDelayLabel = useSeconds ? `${delaySeconds} seconds (+2-5s random)` : `${delayMinutes || 3} minutes`;

    // Determine batch size range for logging
    let batchRangeLabel;
    if (groups.length <= 10) batchRangeLabel = '1-4';
    else if (groups.length <= 30) batchRangeLabel = '3-6';
    else if (groups.length <= 50) batchRangeLabel = '4-7';
    else batchRangeLabel = '6-10';

    console.log(`\n🚀 Starting Group Post automation for ${groups.length} groups (dynamic batch: ${batchRangeLabel} per batch)`);
    console.log(`🌐 Browser: ${browser}`);
    console.log(`⏱️ Delay between batches: ${batchDelayLabel}`);
    console.log(`📦 Package: ${userPackage}`);
    console.log(`🖼️ Images received: ${images ? images.length : 0}`);
    this.addLog(`🚀 เริ่ม Automation: ${groups.length} กลุ่ม (batch ${batchRangeLabel})`, 'start');
    this.addLog(`🌐 Browser: ${browser} | ⏱️ Delay: ${batchDelayLabel}`, 'info');
    this.addLog(`📦 Package: ${userPackage} | 🖼️ รูป: ${images ? images.length : 0}`, 'info');
    if (captionAssignments) {
      console.log(`📝 Using ${Object.keys(captionAssignments).length} caption assignments`);
    }

    try {
      // Initialize browser if needed
      if (!this.browser) {
        try {
          await this.initialize(browser);
        } catch (initError) {
          console.error('❌ Browser init error:', initError.message);
          this.isRunning = false;
          this.endTime = Date.now();
          this.addLog(`❌ เปิด Browser ไม่สำเร็จ: ${initError.message}`, 'error');
          return { success: false, error: `ไม่สามารถเปิด Browser ได้: ${initError.message}`, tasks: this.tasks };
        }
      }

      // Check login
      const isLoggedIn = await this.checkLogin();
      if (!isLoggedIn) {
        console.log('⚠️ Not logged in to Facebook');
        this.isRunning = false;
        this.isPaused = false;
        this.tasks = [];
        this.currentStep = 0;
        this.totalSteps = 0;
        this.endTime = Date.now();
        this.addLog('❌ ยังไม่ได้ Login Facebook', 'error');
        return { success: false, error: 'ยังไม่ได้ Login', errorType: 'login_required', message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดอยู่', tasks: [] };
      }

      await this.handleNotificationPermission();

      // Generate or use provided caption
      let finalCaption = caption;
      if (!finalCaption) {
        finalCaption = await this.generateCaption(property, captionStyle);
      }

      // ── Prepare image files ONCE for all batches ──
      const preparedFilePaths = await this.prepareImageFiles(images);
      if (preparedFilePaths.length > 0) {
        console.log(`🖼️ ${preparedFilePaths.length} image files ready for all tabs`);
      }

      // ── Process groups in dynamic-sized batches ──
      let cursor = 0;
      let batchIdx = 0;

      while (cursor < this.tasks.length) {
        if (!this.isRunning) { console.log('🛑 Automation stopped'); break; }
        while (this.isPaused && this.isRunning) { await this.delay(1000); }

        // Random batch size for THIS batch — different every time like a real person
        const remaining = this.tasks.length - cursor;
        const batchSize = Math.min(this.getRandomBatchSize(this.tasks.length), remaining);
        const batchStart = cursor;
        const batchTasks = this.tasks.slice(batchStart, batchStart + batchSize);
        const estimatedTotalBatches = Math.ceil(this.tasks.length / ((batchSize + (batchIdx > 0 ? batchSize : 0)) / (batchIdx + 1) || batchSize));

        console.log(`\n══════════════════════════════════════`);
        console.log(`📦 Batch ${batchIdx + 1}: ${batchTasks.length} groups [${cursor + 1}-${cursor + batchSize}/${this.tasks.length}] (PARALLEL)`);
        batchTasks.forEach((t, i) => console.log(`   ${batchStart + i + 1}. ${t.groupName}`));
        console.log(`══════════════════════════════════════`);
        this.addLog(`📦 Batch ${batchIdx + 1}: ${batchTasks.length} กลุ่ม [${cursor + 1}-${cursor + batchSize}/${this.tasks.length}]`, 'info');

        // ── CHECKPOINT CHECK before each batch ──
        const checkpoint = await this.detectCheckpoint();
        if (checkpoint.detected) {
          console.log(`🚨 ${checkpoint.type} detected — stopping automation`);
          this.addLog(`🚨 ${checkpoint.type} detected — หยุด automation`, 'error');
          for (const task of batchTasks) {
            task.status = 'failed';
            task.message = `⚠️ Facebook ${checkpoint.type}: ${checkpoint.reason}`;
          }
          // Mark ALL remaining tasks as failed too
          for (let i = cursor + batchSize; i < this.tasks.length; i++) {
            this.tasks[i].status = 'failed';
            this.tasks[i].message = `⚠️ หยุดเนื่องจาก ${checkpoint.type}`;
          }
          this.isRunning = false;
          break;
        }

        // ── SLIDING-WINDOW PARALLEL FLOW ──
        // Like a power user: keep 2-3 tabs open, post in parallel with staggered starts
        // As one finishes → close it → open next group in a new tab
        // Much faster than sequential, still human-like (people DO use multiple tabs)
        const CONCURRENT = Math.min(batchTasks.length, 2 + Math.floor(Math.random() * 2)); // 2-3 concurrent tabs
        console.log(`\n🚀 Posting to ${batchTasks.length} groups (Sliding-Window ×${CONCURRENT})...`);

        let nextIdx = 0; // next task to start
        let completedCount = 0;
        const activeTabs = new Map(); // taskIdx -> page

        // Helper: process a single group (open → post → close)
        const processGroup = async (taskIdx) => {
          const task = batchTasks[taskIdx];
          const globalIdx = batchStart + taskIdx + 1;
          this.currentStep = globalIdx;
          task.status = 'in_progress';

          // Open tab
          let tab;
          if (taskIdx === 0) {
            tab = this.page;
          } else {
            tab = await this.browser.newPage();
            await tab.setExtraHTTPHeaders({ 'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8' });
          }
          activeTabs.set(taskIdx, tab);

          // Navigate
          task.message = 'กำลังเปิดกลุ่ม...';
          console.log(`   🔄 [${globalIdx}/${this.tasks.length}] Opening: ${task.groupName}`);
          this.addLog(`🔄 [${globalIdx}/${this.tasks.length}] เปิดกลุ่ม: ${task.groupName}`, 'info');
          try {
            await tab.goto(task.groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch (e) {
            task.status = 'failed';
            task.message = 'เปิดกลุ่มไม่สำเร็จ';
            console.log(`   ❌ [${globalIdx}] Nav failed: ${task.groupName} — ${e.message}`);
            this.addLog(`❌ [${globalIdx}] เปิดกลุ่มไม่ได้: ${task.groupName}`, 'error');
            if (taskIdx > 0) { try { await tab.close(); } catch { } }
            activeTabs.delete(taskIdx);
            completedCount++;
            return;
          }

          // Post
          let groupCaption = finalCaption;
          if (captionAssignments && captionAssignments[task.groupId]) {
            groupCaption = captionAssignments[task.groupId];
          }
          task.message = 'กำลังโพสต์...';

          try {
            const result = await this.postToGroupOnTab(tab, task.groupUrl, property, groupCaption, images, task.groupName, preparedFilePaths, task);
            if (result.actualGroupName) task.actualGroupName = result.actualGroupName;

            if (result.success) {
              task.status = result.pendingApproval ? 'pending_approval' : 'completed';
              task.message = result.pendingApproval ? 'โพสต์รออนุมัติ' : 'โพสต์สำเร็จ';
              task.postUrl = result.postUrl;
              if (result.pendingApproval) {
                console.log(`   🕓 [${globalIdx}] Pending approval: ${result.actualGroupName || task.groupName}`);
                this.addLog(`🕓 [${globalIdx}] รออนุมัติ: ${result.actualGroupName || task.groupName}`, 'warn');
              } else {
                console.log(`   ✅ [${globalIdx}] Posted: ${result.actualGroupName || task.groupName}`);
                this.addLog(`✅ [${globalIdx}] โพสต์สำเร็จ: ${result.actualGroupName || task.groupName}`, 'success');
              }
              if (this.onPostResult) this.onPostResult(property?.id, task.groupId, result.actualGroupName || task.groupName, true);
            } else {
              task.status = 'failed';
              task.message = result.error || 'โพสต์ไม่สำเร็จ';
              console.log(`   ❌ [${globalIdx}] Failed: ${task.groupName} — ${result.error}`);
              this.addLog(`❌ [${globalIdx}] ล้มเหลว: ${task.groupName} — ${result.error}`, 'error');
              if (this.onPostResult) this.onPostResult(property?.id, task.groupId, task.groupName, false);
            }
          } catch (err) {
            task.status = 'failed';
            task.message = err.message || 'เกิดข้อผิดพลาด';
            console.log(`   ❌ [${globalIdx}] Error: ${task.groupName} — ${err.message}`);
            this.addLog(`❌ [${globalIdx}] Error: ${task.groupName} — ${err.message}`, 'error');
            if (this.onPostResult) this.onPostResult(property?.id, task.groupId, task.groupName, false);
          }

          // Close tab (keep main page)
          if (taskIdx > 0) {
            try { await tab.close(); } catch { }
          }
          activeTabs.delete(taskIdx);
          completedCount++;
        };

        // Launch initial concurrent workers with staggered starts (1-2s apart)
        const workers = [];
        for (let w = 0; w < CONCURRENT && nextIdx < batchTasks.length; w++) {
          if (!this.isRunning) break;
          if (w > 0) {
            const stagger = 800 + Math.floor(Math.random() * 1200); // 0.8-2s stagger
            await this.delay(stagger);
          }
          const idx = nextIdx++;
          workers.push(processGroup(idx));
        }

        // Sliding window: as each finishes, start the next
        while (completedCount < batchTasks.length && this.isRunning) {
          // Wait for any worker to finish
          if (workers.length > 0) {
            try {
              // Use Promise.allSettled to catch errors without crashing
              const settled = await Promise.race(
                workers.filter(Boolean).map((w, i) =>
                  w.then(result => ({ status: 'fulfilled', result, index: i }))
                    .catch(error => ({ status: 'rejected', error, index: i }))
                )
              );
              // If rejected, log but continue - the processGroup handles its own errors
              if (settled.status === 'rejected') {
                console.log(`   ⚠️ Worker ${settled.index} rejected:`, settled.error?.message || 'Unknown error');
              }
            } catch (raceError) {
              // Race itself failed - log and continue
              console.log('   ⚠️ Promise.race error:', raceError.message);
            }
          }

          // Rebuild workers array - remove settled promises
          const stillPending = [];
          for (const w of workers) {
            if (w) {
              // Check if promise is still pending by racing with a microtask
              const isPending = await Promise.race([
                w.then(() => false),
                Promise.resolve(true)
              ]);
              if (isPending) stillPending.push(w);
            }
          }
          workers.length = 0;
          workers.push(...stillPending);

          // Launch new workers for remaining tasks
          while (activeTabs.size < CONCURRENT && nextIdx < batchTasks.length && this.isRunning) {
            while (this.isPaused && this.isRunning) { await this.delay(1000); }
            const stagger = 500 + Math.floor(Math.random() * 1000); // 0.5-1.5s between new tabs
            await this.delay(stagger);
            const idx = nextIdx++;
            workers.push(processGroup(idx));
          }

          // If no more to launch but still active, wait for all remaining
          if (nextIdx >= batchTasks.length && activeTabs.size > 0) {
            await this.delay(500);
          }

          // Safety: break if nothing active and nothing to launch
          if (activeTabs.size === 0 && nextIdx >= batchTasks.length) break;
        }

        console.log(`\n✅ Batch ${batchIdx + 1} completed (${completedCount} groups, ×${CONCURRENT} parallel)`);
        this.addLog(`✅ Batch ${batchIdx + 1} เสร็จ (${completedCount} กลุ่ม)`, 'success');

        // Advance cursor
        cursor += batchSize;
        batchIdx++;

        // Delay between batches (except last)
        if (cursor < this.tasks.length && this.isRunning) {
          let delayMs;
          if (useSeconds) {
            // Seconds mode: user's value + random 2-5 seconds jitter
            const jitter = 2000 + Math.floor(Math.random() * 3000); // 2-5s
            delayMs = (delaySeconds * 1000) + jitter;
            console.log(`\n⏳ Waiting ${delaySeconds}s + ${(jitter / 1000).toFixed(1)}s jitter = ${(delayMs / 1000).toFixed(1)}s before next batch...`);
            this.addLog(`⏳ รอ ${(delayMs / 1000).toFixed(0)}s ก่อน batch ถัดไป...`, 'warn');
          } else {
            // Minutes mode (marketplace): user's value + random ±30s
            delayMs = ((delayMinutes || 3) * 60 + (Math.random() * 60 - 30)) * 1000;
            console.log(`\n⏳ Waiting ~${delayMinutes || 3} min before next batch...`);
            this.addLog(`⏳ รอ ~${delayMinutes || 3} นาทีก่อน batch ถัดไป...`, 'warn');
          }

          // Wait in 5-second chunks so pause/stop can interrupt
          const chunks = Math.ceil(delayMs / 5000);
          for (let c = 0; c < chunks; c++) {
            if (!this.isRunning) break;
            while (this.isPaused && this.isRunning) { await this.delay(1000); }
            await this.delay(Math.min(5000, delayMs - c * 5000));
          }
        }
      }

      this.isRunning = false;
      this.currentTask = null;
      this.endTime = Date.now();

      const completed = this.tasks.filter(t => t.status === 'completed').length;
      const pendingApproval = this.tasks.filter(t => t.status === 'pending_approval').length;
      const failed = this.tasks.filter(t => t.status === 'failed').length;
      const posted = completed + pendingApproval;

      console.log(`\n✅ Automation completed: ${posted} posted (${pendingApproval} pending approval), ${failed} failed out of ${this.tasks.length}`);
      this.addLog(`🏁 Automation เสร็จสิ้น: โพสต์แล้ว ${posted} (รออนุมัติ ${pendingApproval}), ล้มเหลว ${failed} จาก ${this.tasks.length} กลุ่ม`, 'success');

      return {
        success: true,
        message: `โพสต์แล้ว ${posted} กลุ่ม (รออนุมัติ ${pendingApproval}), ล้มเหลว ${failed} กลุ่ม`,
        tasks: this.tasks,
        completed,
        pendingApproval,
        failed,
      };

    } catch (error) {
      this.isRunning = false;
      this.endTime = Date.now();
      this.addLog(`❌ Automation error: ${error.message}`, 'error');
      console.error('Automation error:', error);
      return { success: false, error: error.message, tasks: this.tasks };
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      currentTask: this.currentTask,
      tasks: this.tasks,
      browserConnected: this.isBrowserConnected(),
      logs: this.logs,
      startTime: this.startTime,
      endTime: this.endTime,
      generatedCaptions: this.generatedCaptions,
    };
  }

  // Pause automation
  pause() {
    this.isPaused = true;
    this.addLog('⏸️ Pause automation', 'warn');
    console.log('⏸️ Automation paused');
  }

  // Resume automation
  resume() {
    this.isPaused = false;
    this.addLog('▶️ Resume automation', 'info');
    console.log('▶️ Automation resumed');
  }

  // Stop automation
  async stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.endTime = Date.now();

    if (this.tasks.length > 0) {
      for (const task of this.tasks) {
        if (task.status === 'pending' || task.status === 'in_progress') {
          task.status = 'failed';
          task.message = '🛑 หยุดโดยผู้ใช้';
        }
      }
    }
    this.addLog('🛑 ผู้ใช้หยุด automation', 'warn');

    // Close browser when stopped
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      } catch (e) { }
    }

    console.log('🛑 Automation stopped');
  }
}

// Factory function — creates a new worker per userId (no more singleton)
export function createWorkerForUser(userId) {
  return new GroupPostingWorker(userId);
}
