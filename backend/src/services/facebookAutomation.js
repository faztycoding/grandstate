import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export class FacebookMarketplaceAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.userDataDir = path.join(process.cwd(), 'chrome-data');
  }

  // Helper function for delay (waitForTimeout is deprecated)
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initialize() {
    // Ensure user data directory exists
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    console.log('🔄 Launching browser...');

    // Check for HEADLESS env var (default to false for local dev)
    const isHeadless = process.env.HEADLESS === 'true';

    // Check for PROXY_URL env var
    const proxyUrl = process.env.PROXY_URL; // e.g., http://user:pass@ip:port

    const launchArgs = [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      isHeadless ? '--window-size=1920,1080' : '',
    ];

    if (proxyUrl) {
      launchArgs.push(`--proxy-server=${proxyUrl}`);
    }

    this.browser = await puppeteer.launch({
      headless: isHeadless ? 'new' : false,
      defaultViewport: null,
      args: launchArgs.filter(Boolean),
      userDataDir: this.userDataDir,
    });





    // Wait for browser to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

    // Ensure page is ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Set Thai language
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8'
    });

    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('✅ Browser initialized');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✅ Browser closed');
    }
  }

  async navigateToMarketplace() {
    console.log('🔄 Navigating to Facebook Marketplace...');

    await this.page.goto('https://www.facebook.com/marketplace', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for page to load
    await this.delay(2000);

    // Check if logged in
    const isLoggedIn = await this.page.evaluate(() => {
      return !document.querySelector('input[name="email"]');
    });

    if (!isLoggedIn) {
      console.log('⚠️ Not logged in - Please login manually');
      // Wait for user to login
      await this.page.waitForNavigation({ timeout: 300000 }); // 5 min timeout
    }

    console.log('✅ Navigated to Marketplace');
  }

  async createPropertyListing() {
    console.log('🔄 Creating new property listing...');

    // First, navigate to create listing page
    await this.page.goto('https://www.facebook.com/marketplace/create', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await this.delay(3000);

    // Now select "บ้านสำหรับขายหรือเช่า" (House for Sale or Rent)
    console.log('🔄 Selecting "บ้านสำหรับขายหรือเช่า" category...');

    // Method 1: Click by finding text "บ้านสำหรับขายหรือเช่า"
    const propertySelected = await this.page.evaluate(() => {
      // Find all clickable elements that might be the category cards
      const allElements = document.querySelectorAll('div, span, a');

      for (const el of allElements) {
        const text = el.textContent || '';
        // Check for the property category text
        if (text.includes('บ้านสำหรับขายหรือเช่า') ||
          text.includes('บ้านสำหรับขาย') ||
          text.includes('Home for Sale') ||
          text.includes('Homes for Sale')) {

          // Find the closest clickable parent (the card container)
          let clickTarget = el;
          for (let i = 0; i < 10; i++) {
            if (!clickTarget.parentElement) break;
            clickTarget = clickTarget.parentElement;

            // Check if this is a clickable element
            const role = clickTarget.getAttribute('role');
            const hasClick = clickTarget.onclick !== null;
            const isLink = clickTarget.tagName === 'A';
            const hasHref = clickTarget.hasAttribute('href');

            if (role === 'button' || role === 'link' || hasClick || isLink || hasHref) {
              clickTarget.click();
              return { success: true, method: 'text-search' };
            }
          }

          // If no clickable parent found, try clicking the element itself
          el.click();
          return { success: true, method: 'direct-click' };
        }
      }
      return { success: false };
    });

    console.log('Property selection result:', propertySelected);

    if (!propertySelected.success) {
      // Method 2: Try finding by image/icon - the third card with orange house icon
      console.log('🔄 Trying to find by card position...');

      await this.page.evaluate(() => {
        // Look for category cards - they're usually in a flex/grid container
        const cards = document.querySelectorAll('[role="button"], [role="link"]');

        // Filter to find cards that look like category selectors
        const categoryCards = Array.from(cards).filter(card => {
          const rect = card.getBoundingClientRect();
          // Category cards are usually medium-sized squares
          return rect.width > 100 && rect.width < 300 && rect.height > 100;
        });

        // The "บ้านสำหรับขายหรือเช่า" is typically the 3rd option
        if (categoryCards.length >= 3) {
          categoryCards[2].click();
          return true;
        }

        // Try clicking any card that has house-related content
        for (const card of categoryCards) {
          if (card.innerHTML.includes('บ้าน') || card.innerHTML.includes('home') || card.innerHTML.includes('Home')) {
            card.click();
            return true;
          }
        }

        return false;
      });
    }

    await this.delay(3000);
    console.log('✅ Property listing type selected - Form should now be visible');
  }

  async fillPropertyForm(property, images) {
    console.log('🔄 Filling property form...');
    console.log('Property data:', JSON.stringify(property, null, 2));

    // Wait for form to load
    await this.delay(3000);

    // Prepare form data
    const formData = {
      listingType: property.listingType === 'rent' ? 'บ้านสำหรับเช่า' : 'บ้านสำหรับขาย',
      propertyType: this.mapPropertyType(property.type || property.propertyType),
      bedrooms: property.bedrooms?.toString() || '',
      bathrooms: property.bathrooms?.toString() || '',
      price: property.price?.toString() || '',
      location: property.location || '',
      size: property.size?.toString() || property.squareMeters?.toString() || '',
      description: property.description || this.generateDescription(property),
    };

    console.log('📝 Form data to fill:', formData);

    // Upload images first
    if (images && images.length > 0) {
      console.log(`📷 Uploading ${images.length} images...`);
      await this.uploadImages(images);
      await this.delay(2000);
    }

    // 1. Fill "บ้านสำหรับขายหรือเช่า" dropdown
    console.log('📝 Selecting listing type...');
    await this.selectFacebookDropdown('บ้านสำหรับขายหรือเช่า', formData.listingType);
    await this.delay(500);

    // 2. Fill "ประเภทอสังหาริมทรัพย์" dropdown
    console.log('📝 Selecting property type...');
    await this.selectFacebookDropdown('ประเภทอสังหาริมทรัพย์', formData.propertyType);
    await this.delay(500);

    // 3. Fill "จำนวนห้องนอน" input
    console.log('📝 Filling bedrooms...');
    await this.fillFacebookInput('จำนวนห้องนอน', formData.bedrooms);
    await this.delay(300);

    // 4. Fill "จำนวนห้องน้ำ" input
    console.log('📝 Filling bathrooms...');
    await this.fillFacebookInput('จำนวนห้องน้ำ', formData.bathrooms);
    await this.delay(300);

    // 5. Fill "ราคา" input
    console.log('📝 Filling price...');
    await this.fillFacebookInput('ราคา', formData.price);
    await this.delay(300);

    // 6. Fill location with autocomplete
    console.log('📝 Filling location...');
    await this.fillFacebookLocationInput(formData.location);
    await this.delay(500);

    // 7. Fill "คำอธิบายอสังหาริมทรัพย์" textarea
    console.log('📝 Filling description...');
    await this.fillFacebookTextarea('คำอธิบายอสังหาริมทรัพย์', formData.description);
    await this.delay(300);

    // 8. Fill "ตารางเมตร" input (optional field)
    if (formData.size) {
      console.log('📝 Filling square meters...');
      await this.fillFacebookInput('ตารางเมตร', formData.size);
      await this.delay(300);
    }

    console.log('✅ Form filled successfully');
  }

  // Fill input by finding the label span text
  async fillFacebookInput(labelText, value) {
    if (!value) return;

    try {
      const filled = await this.page.evaluate((label, val) => {
        // Find span with the label text
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent === label || span.textContent?.includes(label)) {
            // Find the closest label element
            const labelEl = span.closest('label');
            if (labelEl) {
              const input = labelEl.querySelector('input');
              if (input) {
                input.focus();
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                return { success: true, method: 'label-input' };
              }
            }

            // Try finding input in parent divs
            let parent = span.parentElement;
            for (let i = 0; i < 5; i++) {
              if (!parent) break;
              const input = parent.querySelector('input[type="text"]');
              if (input && !input.closest('[role="combobox"]')) {
                input.focus();
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, method: 'parent-input' };
              }
              parent = parent.parentElement;
            }
          }
        }
        return { success: false };
      }, labelText, value);

      console.log(`  Input "${labelText}":`, filled);
    } catch (e) {
      console.log(`⚠️ Could not fill input "${labelText}":`, e.message);
    }
  }

  // Select dropdown by finding the combobox label
  async selectFacebookDropdown(labelText, optionValue) {
    if (!optionValue) return;

    try {
      // Click to open dropdown
      await this.page.evaluate((label) => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent === label || span.textContent?.includes(label)) {
            const combobox = span.closest('[role="combobox"]');
            if (combobox) {
              combobox.click();
              return true;
            }
            // Try finding combobox in parent
            let parent = span.parentElement;
            for (let i = 0; i < 5; i++) {
              if (!parent) break;
              const combo = parent.querySelector('[role="combobox"]');
              if (combo) {
                combo.click();
                return true;
              }
              parent = parent.parentElement;
            }
          }
        }
        return false;
      }, labelText);

      await this.delay(500);

      // Select option from dropdown
      const selected = await this.page.evaluate((val) => {
        const options = document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] div');
        for (const option of options) {
          if (option.textContent?.includes(val)) {
            option.click();
            return { success: true, text: option.textContent };
          }
        }
        // Also try clicking any visible option containing the text
        const allDivs = document.querySelectorAll('div[tabindex="-1"], div[role="option"]');
        for (const div of allDivs) {
          if (div.textContent?.includes(val)) {
            div.click();
            return { success: true, text: div.textContent };
          }
        }
        return { success: false };
      }, optionValue);

      console.log(`  Dropdown "${labelText}":`, selected);
    } catch (e) {
      console.log(`⚠️ Could not select dropdown "${labelText}":`, e.message);
    }
  }

  // Fill textarea by finding the label
  async fillFacebookTextarea(labelText, value) {
    if (!value) return;

    try {
      const filled = await this.page.evaluate((label, val) => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent === label || span.textContent?.includes(label)) {
            const labelEl = span.closest('label');
            if (labelEl) {
              const textarea = labelEl.querySelector('textarea');
              if (textarea) {
                textarea.focus();
                textarea.value = val;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true };
              }
            }
          }
        }

        // Fallback: find any textarea
        const textareas = document.querySelectorAll('textarea');
        if (textareas.length > 0) {
          const textarea = textareas[0];
          textarea.focus();
          textarea.value = val;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true, method: 'fallback' };
        }
        return { success: false };
      }, labelText, value);

      console.log(`  Textarea "${labelText}":`, filled);
    } catch (e) {
      console.log(`⚠️ Could not fill textarea "${labelText}":`, e.message);
    }
  }

  // Fill location input with autocomplete handling
  async fillFacebookLocationInput(location) {
    if (!location) return;

    try {
      // Find and fill the location input (it's a combobox with autocomplete)
      await this.page.evaluate((loc) => {
        // Location input has role="combobox" and aria-autocomplete="list"
        const locationInputs = document.querySelectorAll('input[role="combobox"][aria-autocomplete="list"]');
        for (const input of locationInputs) {
          input.focus();
          input.value = loc;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Fallback: find input near location icon (svg with path for pin)
        const svgs = document.querySelectorAll('svg');
        for (const svg of svgs) {
          if (svg.innerHTML.includes('M10 .5A7.5')) { // Location pin icon path
            const container = svg.closest('label');
            if (container) {
              const input = container.querySelector('input');
              if (input) {
                input.focus();
                input.value = loc;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
            }
          }
        }
        return false;
      }, location);

      await this.delay(1500);

      // Select first suggestion from dropdown
      const selected = await this.page.evaluate(() => {
        const suggestions = document.querySelectorAll('[role="option"], [role="listbox"] div[tabindex]');
        if (suggestions.length > 0) {
          suggestions[0].click();
          return { success: true, count: suggestions.length };
        }
        return { success: false };
      });

      console.log('  Location:', selected);
    } catch (e) {
      console.log('⚠️ Could not fill location:', e.message);
    }
  }

  async uploadImages(images) {
    console.log(`🔄 Uploading ${images.length} images...`);

    // Find the file input for images
    const fileInputSelector = 'input[type="file"][accept*="image"]';

    try {
      // Wait for file input
      await this.page.waitForSelector(fileInputSelector, { timeout: 10000 });

      // If images are URLs, we need to download them first
      // If images are base64 or file paths, handle accordingly
      for (const image of images) {
        const inputElement = await this.page.$(fileInputSelector);

        if (image.startsWith('data:')) {
          // Base64 image - save temporarily
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          const tempPath = path.join(process.cwd(), 'temp', `img_${Date.now()}.jpg`);

          if (!fs.existsSync(path.dirname(tempPath))) {
            fs.mkdirSync(path.dirname(tempPath), { recursive: true });
          }

          fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));
          await inputElement.uploadFile(tempPath);

          // Clean up temp file after upload
          setTimeout(() => fs.unlinkSync(tempPath), 5000);
        } else if (fs.existsSync(image)) {
          // File path
          await inputElement.uploadFile(image);
        }

        await this.delay(1000);
      }

      console.log('✅ Images uploaded');
    } catch (error) {
      console.error('⚠️ Error uploading images:', error.message);
    }
  }

  async clickNext() {
    console.log('🔄 Clicking Next button...');

    const nextButtonSelectors = [
      '[aria-label="ถัดไป"]',
      '[aria-label="Next"]',
    ];

    let clicked = false;
    for (const selector of nextButtonSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.click(selector);
        clicked = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!clicked) {
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
        const nextBtn = buttons.find(btn =>
          btn.textContent?.includes('ถัดไป') ||
          btn.textContent?.includes('Next')
        );
        if (nextBtn) nextBtn.click();
      });
    }

    await this.delay(2000);
    console.log('✅ Clicked Next');
  }

  async getAvailableGroups() {
    console.log('🔄 Getting available groups...');

    await this.delay(2000);

    const groups = await this.page.evaluate(() => {
      const groupElements = document.querySelectorAll('[role="checkbox"], [role="listitem"]');
      const groupList = [];

      groupElements.forEach((el, index) => {
        const nameEl = el.querySelector('span[dir="auto"]');
        const spans = el.querySelectorAll('span');
        const memberCountEl = Array.from(spans).find(s => s.textContent?.includes('สมาชิก'));

        if (nameEl) {
          groupList.push({
            id: `group-${index}`,
            name: nameEl.textContent?.trim() || '',
            memberCount: memberCountEl?.textContent || '',
            element: index,
          });
        }
      });

      return groupList;
    });

    console.log(`✅ Found ${groups.length} available groups`);
    return groups;
  }

  async selectGroups(groupIndices) {
    console.log(`🔄 Selecting ${groupIndices.length} groups...`);

    for (const index of groupIndices) {
      await this.page.evaluate((idx) => {
        const checkboxes = document.querySelectorAll('[role="checkbox"]');
        if (checkboxes[idx]) {
          checkboxes[idx].click();
        }
      }, index);

      await this.delay(300);
    }

    console.log('✅ Groups selected');
  }

  async submitPost() {
    console.log('🔄 Submitting post...');

    const submitSelectors = [
      '[aria-label="ประกาศ"]',
      '[aria-label="Publish"]',
      '[aria-label="โพสต์"]',
      '[aria-label="Post"]',
    ];

    let clicked = false;
    for (const selector of submitSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.click(selector);
        clicked = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!clicked) {
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
        const submitBtn = buttons.find(btn =>
          btn.textContent?.includes('ประกาศ') ||
          btn.textContent?.includes('Publish') ||
          btn.textContent?.includes('โพสต์') ||
          btn.textContent?.includes('Post')
        );
        if (submitBtn) submitBtn.click();
      });
    }

    await this.delay(3000);
    console.log('✅ Post submitted');
  }

  mapPropertyType(type) {
    const typeMap = {
      'condo': 'คอนโด',
      'house': 'บ้านเดี่ยว',
      'townhouse': 'ทาวน์เฮ้าส์',
      'land': 'ที่ดิน',
      'apartment': 'อพาร์ตเมนต์',
      'commercial': 'อสังหาริมทรัพย์เชิงพาณิชย์',
    };
    return typeMap[type] || type;
  }

  generateDescription(property) {
    const priceFormatted = new Intl.NumberFormat('th-TH').format(property.price);
    const isRent = property.listingType === 'rent';

    return `🏠 ${property.title}

📍 ที่ตั้ง: ${property.location}, ${property.district}, ${property.province}
💰 ราคา: ${priceFormatted} บาท${isRent ? '/เดือน' : ''}

📐 พื้นที่: ${property.size} ตร.ม.
🛏️ ห้องนอน: ${property.bedrooms}
🚿 ห้องน้ำ: ${property.bathrooms}

${property.amenities?.length ? '✨ สิ่งอำนวยความสะดวก:\n' + property.amenities.map(a => `• ${a}`).join('\n') : ''}

📞 ติดต่อ: ${property.contactPhone}
${property.contactLine ? `💬 LINE: ${property.contactLine}` : ''}

${property.description || ''}`;
  }

  // Update fillFacebookInput to use Human Typing
  async fillFacebookInput(labelText, value) {
    if (!value) return;

    try {
      // 1. Find and Focus the element
      const found = await this.page.evaluate((label) => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent === label || span.textContent?.includes(label)) {
            const labelEl = span.closest('label');
            if (labelEl) {
              const input = labelEl.querySelector('input');
              if (input) {
                input.focus();
                input.click(); // Ensure focus
                // clear existing value if any (simulated)
                input.value = '';
                return true;
              }
            }
            // Try parent search...
            let parent = span.parentElement;
            for (let i = 0; i < 5; i++) {
              if (!parent) break;
              const input = parent.querySelector('input[type="text"]');
              if (input && !input.closest('[role="combobox"]')) {
                input.focus();
                input.click();
                input.value = '';
                return true;
              }
              parent = parent.parentElement;
            }
          }
        }
        return false;
      }, labelText);

      // 2. Type like a human
      if (found) {
        // Random typing speed between 50ms and 150ms
        await this.delay(500); // Pause before typing
        for (const char of value) {
          await this.page.keyboard.type(char);
          await this.delay(Math.random() * 100 + 50);
        }
        await this.delay(500); // Pause after typing
        console.log(`  Input "${labelText}": Typed "${value}"`);
      } else {
        console.log(`⚠️ Could not find input "${labelText}" to focus`);
      }
    } catch (e) {
      console.log(`⚠️ Error filling "${labelText}":`, e.message);
    }
  }

  // Update fillFacebookTextarea to use Human Typing
  async fillFacebookTextarea(labelText, value) {
    if (!value) return;

    try {
      const found = await this.page.evaluate((label) => {
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent === label || span.textContent?.includes(label)) {
            const labelEl = span.closest('label');
            if (labelEl) {
              const textarea = labelEl.querySelector('textarea');
              if (textarea) {
                textarea.focus();
                textarea.click();
                textarea.value = '';
                return true;
              }
            }
          }
        }
        // Fallback
        const textareas = document.querySelectorAll('textarea');
        if (textareas.length > 0) {
          textareas[0].focus();
          textareas[0].click();
          textareas[0].value = '';
          return true;
        }
        return false;
      }, labelText);

      if (found) {
        await this.delay(500);
        // For long descriptions, type faster but still split
        const chunks = value.match(/.{1,10}/g) || [value];
        for (const chunk of chunks) {
          await this.page.keyboard.type(chunk);
          await this.delay(Math.random() * 50 + 20); // Faster for description
        }
        await this.delay(500);
        console.log(`  Textarea "${labelText}": Typed content`);
      }
    } catch (e) {
      console.log(`⚠️ Error filling "${labelText}":`, e.message);
    }
  }
}
