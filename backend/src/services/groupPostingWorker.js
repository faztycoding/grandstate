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

  // Scroll within the dialog (NOT window) — prevents closing the dialog
  async scrollDownInDialog(page, amount = 300) {
    await page.evaluate((scrollAmount) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const d of dialogs) {
        // Find the scrollable div inside the dialog
        const divs = d.querySelectorAll('div');
        for (const el of divs) {
          if (el.scrollHeight > el.clientHeight + 50) {
            el.scrollBy(0, scrollAmount);
            return;
          }
        }
      }
    }, amount);
    await this.delay(400);
  }

  async scrollToLabelOnPage(page, labelText) {
    await page.evaluate((label) => {
      const spans = document.querySelectorAll('span');
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
    if (!value && value !== 0) return;
    const val = String(value);
    console.log(`  ⌨️ Typing "${val}" into "${labelText}"...`);
    await this.scrollToLabelOnPage(page, labelText);

    const inputBox = await page.evaluate((label) => {
      // Search within dialog only
      const spans = document.querySelectorAll('[role="dialog"] span');
      for (const span of spans) {
        const text = (span.textContent || '').trim();
        if (text !== label && !text.includes(label)) continue;
        // SKIP headings/titles
        if (span.closest('h1, h2, h3, h4, [role="heading"]')) continue;
        const labelEl = span.closest('label');
        if (labelEl) {
          const input = labelEl.querySelector('input');
          if (input) {
            input.scrollIntoView({ block: 'center' });
            const rect = input.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
          }
        }
        let parent = span.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!parent) break;
          // Don't walk up past heading or dialog
          if (parent.getAttribute('role') === 'heading' || parent.getAttribute('role') === 'dialog') break;
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

    if (!inputBox.found) { console.log(`    ⚠️ Input "${labelText}" not found`); return; }
    await page.mouse.click(inputBox.x, inputBox.y);
    await this.delay(300);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await this.delay(200);
    await page.keyboard.type(val, { delay: 30 + Math.random() * 20 });
    console.log(`    ✅ Done`);
  }

  async nativeSelectDropdownOnPage(page, labelText, optionValue) {
    if (!optionValue) return;
    console.log(`  🔽 Selecting "${optionValue}" in dropdown "${labelText}"...`);
    await this.scrollToLabelOnPage(page, labelText);

    const dropdownBox = await page.evaluate((label) => {
      // Search ONLY within dialog form body — NEVER match title/header elements
      const spans = document.querySelectorAll('[role="dialog"] span');
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
      return;
    }
    console.log(`    📍 Found dropdown via ${dropdownBox.method} at (${Math.round(dropdownBox.x)}, ${Math.round(dropdownBox.y)})`);
    await page.mouse.click(dropdownBox.x, dropdownBox.y);
    await this.delay(1000);

    const optionBox = await page.evaluate((val) => {
      const selectors = '[role="option"], [role="menuitem"], [role="listbox"] [role="option"]';
      let options = document.querySelectorAll(selectors);
      if (options.length === 0) {
        options = document.querySelectorAll('[role="listbox"] div, [role="menu"] div');
      }
      for (const option of options) {
        const text = (option.textContent || '').trim();
        if (text === val || text.includes(val)) {
          const rect = option.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
      }
      // Broader search: leaf elements with exact text
      const allEls = document.querySelectorAll('span, div');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = (el.textContent || '').trim();
        if (text === val) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.y > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
        }
      }
      return { found: false };
    }, optionValue);

    if (optionBox.found) {
      await page.mouse.click(optionBox.x, optionBox.y);
      console.log(`    ✅ Selected "${optionValue}"`);
    } else {
      console.log(`    ⚠️ Option "${optionValue}" not found — scrolling down in dialog to close dropdown`);
      // Safe way to dismiss dropdown: scroll the dialog slightly
      await this.scrollDownInDialog(page, 50);
    }
    await this.delay(500);
  }

  async nativeTypeTextareaOnPage(page, labelText, value) {
    if (!value) return;
    console.log(`  📝 Typing description...`);
    await this.scrollDownInDialog(page, 300);
    await this.delay(500);

    const labelVariants = [labelText, 'คำอธิบาย', 'คำอธิบายอสังหาริมทรัพย์', 'คำอธิบายของที่พักให้เช่า', 'Description'];
    const textareaBox = await page.evaluate((labels) => {
      for (const label of labels) {
        // Search within dialog only
        const spans = document.querySelectorAll('[role="dialog"] span');
        for (const span of spans) {
          const text = (span.textContent || '').trim();
          if (!text.includes(label)) continue;
          // SKIP headings/titles
          if (span.closest('h1, h2, h3, h4, [role="heading"]')) continue;
          const labelEl = span.closest('label');
          if (labelEl) {
            const ta = labelEl.querySelector('textarea');
            if (ta) { ta.scrollIntoView({ block: 'center' }); const rect = ta.getBoundingClientRect(); if (rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true }; }
          }
          let parent = span.parentElement;
          for (let i = 0; i < 10; i++) {
            if (!parent) break;
            if (parent.getAttribute('role') === 'heading' || parent.getAttribute('role') === 'dialog') break;
            const ta = parent.querySelector('textarea');
            if (ta) { ta.scrollIntoView({ block: 'center' }); const rect = ta.getBoundingClientRect(); if (rect.height > 0) return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true }; }
            parent = parent.parentElement;
          }
        }
      }
      // Fallback: find any textarea in dialog
      const allTa = document.querySelectorAll('[role="dialog"] textarea');
      for (const ta of allTa) {
        const rect = ta.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 30 && rect.y > 0) {
          ta.scrollIntoView({ block: 'center' }); const r = ta.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
        }
      }
      return { found: false };
    }, labelVariants);

    if (!textareaBox.found) { console.log(`    ⚠️ Textarea not found`); return; }
    await page.mouse.click(textareaBox.x, textareaBox.y);
    await this.delay(500);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await this.delay(200);
    await page.keyboard.type(value, { delay: 15 + Math.random() * 10 });
    console.log(`    ✅ Description typed (${value.length} chars)`);
  }

  async nativeFillLocationOnPage(page, location) {
    if (!location) return;
    console.log(`  📍 Filling location: "${location}"...`);
    await this.scrollDownInDialog(page, 300);
    await this.delay(800);

    const locationBox = await page.evaluate(() => {
      // Search within dialog only
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { found: false };
      const labels = dialog.querySelectorAll('label');
      for (const label of labels) {
        const svg = label.querySelector('svg');
        const input = label.querySelector('input[role="combobox"], input[type="text"], input:not([type])');
        if (svg && input) {
          const rect = input.getBoundingClientRect();
          if (rect.y > 150 && rect.width > 50 && rect.height > 0) {
            input.scrollIntoView({ block: 'center' });
            const r = input.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
          }
        }
      }
      const combos = dialog.querySelectorAll('input[role="combobox"]');
      for (const input of combos) {
        const rect = input.getBoundingClientRect();
        if (rect.y < 150) continue;
        if (!input.value && rect.width > 50 && rect.height > 0) {
          input.scrollIntoView({ block: 'center' });
          const r = input.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: true };
        }
      }
      return { found: false };
    });

    if (!locationBox.found) { console.log(`    ⚠️ Location input not found`); return; }

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
        return;
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

      // Step 2: Dialog "สร้างรายการสินค้าใหม่" → Click "บ้านสำหรับขายหรือเช่า"
      // MUST use native mouse click — Facebook React ignores JS .click()
      updateMsg('เลือกประเภท บ้านสำหรับขายหรือเช่า...');
      console.log('📌 Selecting "บ้านสำหรับขายหรือเช่า" category...');
      const keywords = ['บ้านสำหรับขายหรือเช่า', 'บ้านสำหรับขาย', 'Home for Sale', 'Homes for Sale or Rent'];

      let cardClicked = false;
      for (let attempt = 0; attempt < 3 && !cardClicked; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry ${attempt + 1}/3...`);
          await this.delay(2000);
        }

        const cardBox = await page.evaluate((kws) => {
          const allSpans = document.querySelectorAll('span');
          for (const span of allSpans) {
            const text = (span.textContent || '').trim();
            if (!kws.some(kw => text === kw || text.includes(kw))) continue;
            // Walk up to find card container with icon
            let card = span;
            for (let i = 0; i < 15; i++) {
              if (!card.parentElement) break;
              card = card.parentElement;
              const hasIcon = card.querySelector('i[data-visualcompletion="css-img"]');
              if (hasIcon || card.getAttribute('role') === 'button') {
                const rect = card.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'card' };
                }
              }
            }
            // Fallback: use span position
            const rect = span.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'span' };
            }
          }
          return { found: false };
        }, keywords);

        if (cardBox.found) {
          console.log(`   📍 Found via ${cardBox.method} at (${Math.round(cardBox.x)}, ${Math.round(cardBox.y)})`);
          await page.mouse.click(cardBox.x, cardBox.y);
          cardClicked = true;
        }
      }

      if (!cardClicked) {
        return { success: false, error: 'ไม่พบปุ่ม "บ้านสำหรับขายหรือเช่า"' };
      }
      await this.delay(3000);

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
      const dialogStillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
      if (!dialogStillOpen) {
        console.log('❌ Dialog closed after image upload!');
        return { success: false, error: 'Dialog ปิดหลังอัพโหลดรูป — กรุณาลองใหม่' };
      }
      console.log('✅ Dialog still open — continuing form fill...');
      updateMsg('กรอกข้อมูลสินทรัพย์...');

      // 3b. Listing type: ให้เช่า / สำหรับขาย
      await this.nativeSelectDropdownOnPage(page, 'บ้านสำหรับขายหรือเช่า', listingTypeLabel);
      await this.delay(500);

      // 3c. Property type
      const propTypeLabels = property.listingType === 'rent'
        ? ['ประเภทของที่พักให้เช่า', 'ประเภท']
        : ['ประเภทอสังหาริมทรัพย์', 'ประเภทของที่พักสำหรับขาย', 'ประเภท'];
      for (const label of propTypeLabels) {
        const exists = await page.evaluate((lbl) => {
          const spans = document.querySelectorAll('span');
          for (const s of spans) { if ((s.textContent || '').trim().includes(lbl)) return true; }
          return false;
        }, label);
        if (exists) { await this.nativeSelectDropdownOnPage(page, label, propertyTypeLabel); break; }
      }
      await this.delay(500);

      // 3d. Bedrooms
      await this.nativeTypeOnPage(page, 'จำนวนห้องนอน', bedrooms);
      await this.delay(300);

      // 3e. Bathrooms
      await this.nativeTypeOnPage(page, 'จำนวนห้องน้ำ', bathrooms);
      await this.delay(300);

      // 3f. Price
      const priceLabel = property.listingType === 'rent' ? 'ราคาต่อเดือน' : 'ราคา';
      await this.nativeTypeOnPage(page, priceLabel, price);
      await this.delay(300);

      // 3g. Location
      await this.nativeFillLocationOnPage(page, location);
      await this.delay(500);

      // 3h. Description
      const descLabel = property.listingType === 'rent' ? 'คำอธิบายของที่พักให้เช่า' : 'คำอธิบายอสังหาริมทรัพย์';
      await this.nativeTypeTextareaOnPage(page, descLabel, description);
      await this.delay(300);

      // 3i. Square meters
      if (size && size !== '0') {
        await this.scrollDownInDialog(page, 300);
        await this.delay(500);
        await this.nativeTypeOnPage(page, 'ตารางเมตร', size);
        await this.delay(300);
      }

      console.log('✅ Form filled!');

      // Step 4: Click "ถัดไป" (Next) — MUST use native mouse click
      updateMsg('กดถัดไป...');
      console.log('🔄 Clicking "ถัดไป"...');
      let nextClicked = false;
      for (let attempt = 0; attempt < 5 && !nextClicked; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry ถัดไป ${attempt + 1}/5...`);
          await this.delay(2000);
        }
        const nextBox = await page.evaluate(() => {
          const buttons = document.querySelectorAll('[role="button"], button');
          for (const btn of buttons) {
            const spans = btn.querySelectorAll('span');
            let btnText = '';
            if (spans.length > 0) {
              // Use innermost span text to avoid matching parent containers
              for (const s of spans) {
                const t = (s.textContent || '').trim();
                if (t === 'ถัดไป' || t === 'Next') { btnText = t; break; }
              }
            }
            if (!btnText) btnText = (btn.textContent || '').trim();
            const label = btn.getAttribute('aria-label') || '';
            if (btnText === 'ถัดไป' || btnText === 'Next' || label === 'ถัดไป' || label === 'Next') {
              const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
              if (isDisabled) continue;
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: btnText };
              }
            }
          }
          return { found: false };
        });

        if (nextBox.found) {
          console.log(`   📍 "ถัดไป" at (${Math.round(nextBox.x)}, ${Math.round(nextBox.y)}) text="${nextBox.text}"`);
          await page.mouse.click(nextBox.x, nextBox.y);
          nextClicked = true;
        }
      }

      if (!nextClicked) {
        return { success: false, error: 'ไม่สามารถกดปุ่มถัดไปได้' };
      }

      // Wait for "แชร์ไปยังที่อื่นๆ เพิ่มเติม" page to load
      console.log('⏳ Waiting for share page...');
      await this.delay(5000);

      // Step 5: Tick Marketplace checkbox — use native mouse click on the checkbox area
      updateMsg('ติ้ก Marketplace...');
      console.log('📌 Ticking Marketplace checkbox...');

      // Find Marketplace row and click the checkbox/toggle on the right side
      let mktClicked = false;
      for (let attempt = 0; attempt < 5 && !mktClicked; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry Marketplace tick ${attempt + 1}/5...`);
          await this.delay(2000);
          // Scroll down in case Marketplace row is below fold
          await this.scrollDownInDialog(page, 200);
        }
        const mktBox = await page.evaluate(() => {
          const allSpans = document.querySelectorAll('span');
          for (const span of allSpans) {
            const text = (span.textContent || '').trim();
            if (text !== 'Marketplace') continue;

            // Strategy 1: Walk up to find the row, then find checkbox/toggle inside
            let row = span;
            for (let i = 0; i < 10; i++) {
              if (!row.parentElement) break;
              row = row.parentElement;

              // Check for actual checkbox/toggle input
              const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"], [role="switch"]');
              if (checkbox) {
                const isChecked = checkbox.checked || checkbox.getAttribute('aria-checked') === 'true';
                if (isChecked) return { already: true };
                const rect = checkbox.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, method: 'checkbox' };
                }
              }

              const rect = row.getBoundingClientRect();
              // The Marketplace row is typically 50-120px tall and > 200px wide
              if (rect.height > 40 && rect.height < 140 && rect.width > 200) {
                // Click on the right side where the toggle/checkbox typically is
                return { x: rect.x + rect.width - 30, y: rect.y + rect.height / 2, found: true, method: 'row-right' };
              }
            }

            // Strategy 2: Use the span's position and click to the far right on same Y
            const spanRect = span.getBoundingClientRect();
            if (spanRect.width > 0 && spanRect.height > 0) {
              // The page is typically ~600px wide, checkbox is at the right edge
              const pageWidth = window.innerWidth || document.documentElement.clientWidth;
              return { x: pageWidth - 50, y: spanRect.y + spanRect.height / 2, found: true, method: 'span-right' };
            }
          }
          return { found: false };
        });

        if (mktBox.already) {
          console.log('✅ Marketplace already checked');
          mktClicked = true;
        } else if (mktBox.found) {
          console.log(`   📍 Marketplace checkbox via ${mktBox.method} at (${Math.round(mktBox.x)}, ${Math.round(mktBox.y)})`);
          await page.mouse.click(mktBox.x, mktBox.y);
          await this.delay(500);
          // Verify it was ticked
          const verified = await page.evaluate(() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="switch"]');
            for (const cb of checkboxes) {
              if (cb.checked || cb.getAttribute('aria-checked') === 'true') return true;
            }
            return false;
          });
          if (verified) {
            mktClicked = true;
            console.log('✅ Marketplace checkbox ticked & verified');
          } else {
            console.log('   ⚠️ Click might not have registered — retrying...');
          }
        }
      }
      if (!mktClicked) {
        console.log('⚠️ Marketplace checkbox not found — continuing anyway');
      }
      await this.delay(1500);

      // Step 6: Scroll down to bottom of the share page
      console.log('📜 Scrolling to bottom...');
      // Scroll multiple times to ensure we reach the bottom
      for (let scrollAttempt = 0; scrollAttempt < 3; scrollAttempt++) {
        await page.evaluate(() => {
          const dialogs = document.querySelectorAll('[role="dialog"]');
          for (const d of dialogs) {
            // Find scrollable containers inside the dialog
            const scrollables = d.querySelectorAll('div');
            for (const el of scrollables) {
              if (el.scrollHeight > el.clientHeight + 50) {
                el.scrollTop = el.scrollHeight;
              }
            }
          }
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.delay(1000);
      }
      await this.delay(1000);

      // Step 7: Click "โพสต์" button — MUST use native mouse click
      updateMsg('กำลังกดโพสต์...');
      console.log('🔄 Clicking "โพสต์"...');
      const preSubmitDelay = 1000 + Math.floor(Math.random() * 2000);
      await this.delay(preSubmitDelay);

      let posted = false;
      const postKeywords = ['โพสต์', 'Post', 'ลงประกาศ', 'Publish'];
      for (let attempt = 0; attempt < 5 && !posted; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry โพสต์ ${attempt + 1}/5...`);
          await this.delay(2000);
          // Re-scroll down on retry
          await page.evaluate(() => {
            const dialogs = document.querySelectorAll('[role="dialog"]');
            for (const d of dialogs) {
              const scrollables = d.querySelectorAll('div');
              for (const el of scrollables) {
                if (el.scrollHeight > el.clientHeight + 50) {
                  el.scrollTop = el.scrollHeight;
                }
              }
            }
            window.scrollTo(0, document.body.scrollHeight);
          });
          await this.delay(1000);
        }

        const postBox = await page.evaluate((keywords) => {
          const buttons = document.querySelectorAll('[role="button"], button');
          for (const btn of buttons) {
            // Check innermost span text first
            const spans = btn.querySelectorAll('span');
            let btnText = '';
            for (const s of spans) {
              const t = (s.textContent || '').trim();
              if (keywords.includes(t)) { btnText = t; break; }
            }
            if (!btnText) btnText = (btn.textContent || '').trim();
            const label = btn.getAttribute('aria-label') || '';

            const matched = keywords.includes(btnText) || keywords.includes(label);
            if (!matched) continue;

            const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
            if (isDisabled) continue;

            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: btnText };
            }
          }
          return { found: false };
        }, postKeywords);

        if (postBox.found) {
          console.log(`   📍 "${postBox.text}" at (${Math.round(postBox.x)}, ${Math.round(postBox.y)})`);
          await page.mouse.click(postBox.x, postBox.y);
          posted = true;
        }
      }

      if (!posted) {
        return { success: false, error: 'ไม่สามารถกดปุ่มโพสต์ได้' };
      }

      console.log('⏳ Waiting for post to complete...');
      await this.delay(5000);

      // Step 8: Click "ลงประกาศ" on the "เผยแพร่รายการสินค้าแล้ว" dialog if it appears
      updateMsg('กดลงประกาศ...');
      console.log('📌 Looking for "ลงประกาศ" button on publish dialog...');
      const publishKeywords = ['ลงประกาศ', 'Publish', 'List Item'];
      let publishClicked = false;
      for (let attempt = 0; attempt < 5 && !publishClicked; attempt++) {
        if (attempt > 0) {
          console.log(`   🔄 Retry ลงประกาศ ${attempt + 1}/5...`);
          await this.delay(2000);
        }
        const publishBox = await page.evaluate((keywords) => {
          const buttons = document.querySelectorAll('[role="button"], button');
          for (const btn of buttons) {
            const spans = btn.querySelectorAll('span');
            let btnText = '';
            for (const s of spans) {
              const t = (s.textContent || '').trim();
              if (keywords.includes(t)) { btnText = t; break; }
            }
            if (!btnText) btnText = (btn.textContent || '').trim();
            const label = btn.getAttribute('aria-label') || '';
            const matched = keywords.includes(btnText) || keywords.includes(label);
            if (!matched) continue;
            const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
            if (isDisabled) continue;
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true, text: btnText };
            }
          }
          return { found: false };
        }, publishKeywords);

        if (publishBox.found) {
          console.log(`   📍 "${publishBox.text}" at (${Math.round(publishBox.x)}, ${Math.round(publishBox.y)})`);
          await page.mouse.click(publishBox.x, publishBox.y);
          publishClicked = true;
          console.log('✅ "ลงประกาศ" clicked');
        }
      }
      if (!publishClicked) {
        console.log('ℹ️ "ลงประกาศ" dialog not found — may have auto-closed');
      }
      await this.delay(3000);

      console.log('✅ Buy/sell listing posted successfully!');
      return { success: true, postUrl: null };

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
      } catch (e) {}
      this.browser = null;
      this.page = null;
    }

    this.selectedBrowser = browserType;

    const isVPS = process.platform === 'linux';
    const isHeadless = process.env.HEADLESS === 'true' || isVPS;

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
      defaultViewport: isHeadless ? { width: 1920, height: 1080 } : null,
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
    console.log('🔄 Auto-resetting state after browser closed...');
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.isPaused = false;
    this.tasks = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    this.currentTask = null;
    console.log('✅ State reset - ready for fresh start');
  }

  async close() {
    this.isRunning = false;
    this.isPaused = false;
    
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
            try { fs.unlinkSync(fp); } catch (e) {}
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

      // ── Step 1.2: Dismiss any overlays (Notifications panel, popups) ──
      console.log('🔕 Dismissing overlays...');
      try {
        // Press Escape to close any popup/overlay
        await page.keyboard.press('Escape');
        await this.delay(500);
        // Click on the main content area to deselect any sidebar
        await page.evaluate(() => {
          const main = document.querySelector('[role="main"]');
          if (main) main.click();
        });
        await this.delay(500);
        // Close notification panel if open (click the close button or click away)
        await page.evaluate(() => {
          // Try closing notification popover
          const closeButtons = document.querySelectorAll('[aria-label="Close"], [aria-label="ปิด"]');
          for (const btn of closeButtons) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              btn.click();
              break;
            }
          }
        });
        await this.delay(500);
      } catch (e) {
        // Ignore dismiss errors
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
      console.log(`⏱️ Pre-submit pause: ${(preSubmitDelay/1000).toFixed(1)}s`);
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
      setTimeout(() => { for (const fp of filePaths) { if (fp.includes('temp')) { try { fs.unlinkSync(fp); } catch (e) {} } } }, 300000);
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

        // ── CHECKPOINT CHECK before each batch ──
        const checkpoint = await this.detectCheckpoint();
        if (checkpoint.detected) {
          console.log(`🚨 ${checkpoint.type} detected — stopping automation`);
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
          try {
            await tab.goto(task.groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch (e) {
            task.status = 'failed';
            task.message = 'เปิดกลุ่มไม่สำเร็จ';
            console.log(`   ❌ [${globalIdx}] Nav failed: ${task.groupName} — ${e.message}`);
            if (taskIdx > 0) { try { await tab.close(); } catch {} }
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
              task.status = 'completed';
              task.message = 'โพสต์สำเร็จ';
              task.postUrl = result.postUrl;
              console.log(`   ✅ [${globalIdx}] Posted: ${result.actualGroupName || task.groupName}`);
              if (this.onPostResult) this.onPostResult(property?.id, task.groupId, result.actualGroupName || task.groupName, true);
            } else {
              task.status = 'failed';
              task.message = result.error || 'โพสต์ไม่สำเร็จ';
              console.log(`   ❌ [${globalIdx}] Failed: ${task.groupName} — ${result.error}`);
              if (this.onPostResult) this.onPostResult(property?.id, task.groupId, task.groupName, false);
            }
          } catch (err) {
            task.status = 'failed';
            task.message = err.message || 'เกิดข้อผิดพลาด';
            console.log(`   ❌ [${globalIdx}] Error: ${task.groupName} — ${err.message}`);
            if (this.onPostResult) this.onPostResult(property?.id, task.groupId, task.groupName, false);
          }

          // Close tab (keep main page)
          if (taskIdx > 0) {
            try { await tab.close(); } catch {}
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
            console.log(`\n⏳ Waiting ${delaySeconds}s + ${(jitter/1000).toFixed(1)}s jitter = ${(delayMs/1000).toFixed(1)}s before next batch...`);
          } else {
            // Minutes mode (marketplace): user's value + random ±30s
            delayMs = ((delayMinutes || 3) * 60 + (Math.random() * 60 - 30)) * 1000;
            console.log(`\n⏳ Waiting ~${delayMinutes || 3} min before next batch...`);
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

      const completed = this.tasks.filter(t => t.status === 'completed').length;
      const failed = this.tasks.filter(t => t.status === 'failed').length;

      console.log(`\n✅ Automation completed: ${completed} success, ${failed} failed out of ${this.tasks.length}`);

      return {
        success: true,
        message: `โพสต์สำเร็จ ${completed} กลุ่ม, ล้มเหลว ${failed} กลุ่ม`,
        tasks: this.tasks,
        completed,
        failed,
      };

    } catch (error) {
      this.isRunning = false;
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
    };
  }

  // Pause automation
  pause() {
    this.isPaused = true;
    console.log('⏸️ Automation paused');
  }

  // Resume automation
  resume() {
    this.isPaused = false;
    console.log('▶️ Automation resumed');
  }

  // Stop automation
  async stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.tasks = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    
    // Close browser when stopped
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      } catch (e) {}
    }
    
    console.log('🛑 Automation stopped and reset');
  }
}

// Factory function — creates a new worker per userId (no more singleton)
export function createWorkerForUser(userId) {
  return new GroupPostingWorker(userId);
}
