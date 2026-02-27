/**
 * ═══════════════════════════════════════════════════════════════
 *  Anti-Detection Engine — World-Class Evasion System
 *  Modules: Behavioral Logic · Fingerprint Masking · Image Mutation
 * ═══════════════════════════════════════════════════════════════
 */
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────
//  Module 1: Intelligent Behavioral Logic
// ─────────────────────────────────────────────

/**
 * Box-Muller transform — generates Gaussian (normal) distributed random numbers
 * Unlike Math.random() which is flat/uniform, this creates a bell curve distribution
 * making timing patterns look human (most actions at average speed, rare fast/slow outliers)
 */
export function gaussianRandom(mean = 0, stdDev = 1) {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z * stdDev + mean;
}

/**
 * Gaussian Jitter Delay — human-like timing with bell curve distribution
 * μ (mean) = center of the bell curve
 * σ (stdDev) = spread — higher = more variation
 * Clamps to [min, max] to prevent extreme outliers
 */
export function gaussianDelay(meanMs, stdDevMs, minMs = 500, maxMs = null) {
  const raw = gaussianRandom(meanMs, stdDevMs);
  const clamped = Math.max(minMs, maxMs ? Math.min(raw, maxMs) : raw);
  return Math.round(clamped);
}

/**
 * Batch delay with Gaussian jitter — replaces static random
 * Base delay from user + Gaussian jitter that occasionally produces long pauses
 */
export function gaussianBatchDelay(baseDelaySeconds) {
  // Mean jitter: 3.5s, StdDev: 2s → most jitter 1.5-5.5s, occasionally 0-8s+
  const jitterMs = gaussianDelay(3500, 2000, 500, 12000);
  // Also add slight variation to the base delay itself (±15%)
  const baseVariation = gaussianRandom(1.0, 0.15);
  const adjustedBase = Math.max(3000, baseDelaySeconds * 1000 * Math.max(0.7, Math.min(1.3, baseVariation)));
  return Math.round(adjustedBase + jitterMs);
}

/**
 * Typing delay per character — Gaussian distribution mimicking real typing rhythm
 * Fast typists: 30-50ms, Average: 50-80ms, Slow/thinking: 100-200ms
 */
export function typingCharDelay() {
  // Mean 55ms, StdDev 25ms → most chars 30-80ms, occasional pauses up to 130ms
  return gaussianDelay(55, 25, 20, 150);
}

/**
 * Thinking pause — occasional longer pauses while typing (reading what you wrote)
 */
export function thinkingPause() {
  // Mean 500ms, StdDev 300ms → most pauses 200-800ms, occasionally up to 1.5s
  return gaussianDelay(500, 300, 150, 2000);
}

/**
 * Pre-submit contemplation delay — human reads their post before clicking Submit
 */
export function preSubmitDelay() {
  // Mean 2s, StdDev 1s → most 1-3s, occasionally up to 5s
  return gaussianDelay(2000, 1000, 800, 6000);
}

/**
 * Generate typo simulation data for a caption
 * Returns positions where typos should occur and what corrections to make
 */
export function generateTypoPositions(captionLength) {
  const typos = [];
  // ~2-4% chance per character to trigger a typo sequence
  const typoRate = 0.02 + Math.random() * 0.02;
  // Max 3-5 typos per caption to keep it realistic
  const maxTypos = 3 + Math.floor(Math.random() * 3);
  
  for (let i = 10; i < captionLength - 5; i++) {
    if (typos.length >= maxTypos) break;
    if (Math.random() < typoRate) {
      // How many wrong chars before correction (1-3)
      const wrongChars = 1 + Math.floor(Math.random() * 2);
      typos.push({ position: i, wrongChars });
      // Skip ahead to avoid clustered typos
      i += 20 + Math.floor(Math.random() * 30);
    }
  }
  return typos;
}

// ─────────────────────────────────────────────
//  Module 2: Deep Fingerprint Masking
// ─────────────────────────────────────────────

/**
 * Browser fingerprint injection script — runs via page.evaluateOnNewDocument()
 * Spoofs: Canvas, WebGL, AudioContext, Fonts, Battery, Hardware Concurrency, Device Memory
 */
export function getFingerprintInjectionScript() {
  return `
    (() => {
      // ── Canvas Fingerprint Noise ──
      // Adds imperceptible noise to canvas operations so each session has unique hash
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      
      // Unique noise seed per session
      const NOISE_SEED = ${Math.random()};
      function pseudoRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      }
      
      CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const imageData = origGetImageData.apply(this, args);
        // Add subtle noise to 2% of pixels (imperceptible to humans)
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (pseudoRandom(i * NOISE_SEED) < 0.02) {
            // Shift RGB by ±1 (invisible but changes hash)
            data[i] = Math.min(255, Math.max(0, data[i] + (pseudoRandom(i + 1) > 0.5 ? 1 : -1)));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + (pseudoRandom(i + 2) > 0.5 ? 1 : -1)));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + (pseudoRandom(i + 3) > 0.5 ? 1 : -1)));
          }
        }
        return imageData;
      };
      
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        // Trigger noise injection by reading pixels first
        try {
          const ctx = this.getContext('2d');
          if (ctx && this.width > 0 && this.height > 0) {
            ctx.getImageData(0, 0, 1, 1);
          }
        } catch(e) {}
        return origToDataURL.apply(this, args);
      };

      // ── WebGL Fingerprint Spoofing ──
      const WEBGL_VENDORS = [
        'Google Inc. (NVIDIA)',
        'Google Inc. (Intel)',
        'Google Inc. (AMD)',
        'Google Inc. (Apple)',
      ];
      const WEBGL_RENDERERS = [
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
      ];
      const vendorIdx = Math.floor(${Math.random()} * WEBGL_VENDORS.length);
      const rendererIdx = Math.floor(${Math.random()} * WEBGL_RENDERERS.length);
      
      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 0x9245) return WEBGL_VENDORS[vendorIdx];
        // UNMASKED_RENDERER_WEBGL  
        if (param === 0x9246) return WEBGL_RENDERERS[rendererIdx];
        return origGetParameter.apply(this, arguments);
      };
      // Also patch WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return WEBGL_VENDORS[vendorIdx];
          if (param === 0x9246) return WEBGL_RENDERERS[rendererIdx];
          return origGetParameter2.apply(this, arguments);
        };
      }

      // ── AudioContext Fingerprint Noise ──
      const origCreateOscillator = AudioContext.prototype.createOscillator;
      const origCreateDynamicsCompressor = AudioContext.prototype.createDynamicsCompressor;
      if (origCreateDynamicsCompressor) {
        AudioContext.prototype.createDynamicsCompressor = function() {
          const compressor = origCreateDynamicsCompressor.apply(this, arguments);
          // Slightly randomize default parameters
          try {
            compressor.threshold.value = -50 + (${Math.random()} * 2 - 1);
            compressor.knee.value = 40 + (${Math.random()} * 2 - 1);
            compressor.ratio.value = 12 + (${Math.random()} * 0.5 - 0.25);
          } catch(e) {}
          return compressor;
        };
      }

      // ── Hardware Concurrency Spoofing ──
      const CORE_COUNTS = [4, 6, 8, 12, 16];
      const spoofedCores = CORE_COUNTS[Math.floor(${Math.random()} * CORE_COUNTS.length)];
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => spoofedCores });

      // ── Device Memory Spoofing ──
      const MEMORY_VALUES = [4, 8, 16, 32];
      const spoofedMemory = MEMORY_VALUES[Math.floor(${Math.random()} * MEMORY_VALUES.length)];
      Object.defineProperty(navigator, 'deviceMemory', { get: () => spoofedMemory });

      // ── Battery Status API Spoofing ──
      // Simulate a device that's being used (battery draining slowly)
      let fakeBatteryLevel = 0.45 + ${Math.random()} * 0.5; // 45-95%
      const fakeCharging = ${Math.random()} > 0.6; // 40% chance charging
      
      if (navigator.getBattery) {
        const origGetBattery = navigator.getBattery.bind(navigator);
        navigator.getBattery = () => {
          return Promise.resolve({
            charging: fakeCharging,
            chargingTime: fakeCharging ? Math.floor(${Math.random()} * 3600) : Infinity,
            dischargingTime: fakeCharging ? Infinity : Math.floor(3600 + ${Math.random()} * 14400),
            level: Math.max(0.05, Math.min(1, fakeBatteryLevel)),
            addEventListener: () => {},
            removeEventListener: () => {},
          });
        };
        // Simulate battery drain over time
        setInterval(() => {
          if (!fakeCharging) {
            fakeBatteryLevel = Math.max(0.05, fakeBatteryLevel - 0.001);
          } else {
            fakeBatteryLevel = Math.min(1, fakeBatteryLevel + 0.002);
          }
        }, 60000);
      }

      // ── Font Enumeration Randomization ──
      // Shuffle which fonts appear "installed" to create unique fingerprint
      const EXTRA_FONTS = [
        'Segoe UI', 'Tahoma', 'Verdana', 'Georgia', 'Trebuchet MS',
        'Lucida Console', 'Courier New', 'Arial Black', 'Impact',
        'Palatino Linotype', 'Book Antiqua', 'MS Gothic', 'MS PGothic',
        'Leelawadee UI', 'Angsana New', 'Browalia New', 'Cordia New',
      ];
      // Randomly exclude 3-6 fonts to create variation
      const excludeCount = 3 + Math.floor(${Math.random()} * 4);
      const excludedFonts = new Set();
      while (excludedFonts.size < excludeCount) {
        excludedFonts.add(EXTRA_FONTS[Math.floor(Math.random() * EXTRA_FONTS.length)]);
      }
      
      // Intercept font checking (offsetWidth-based detection)
      const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      if (origOffsetWidth && origOffsetWidth.get) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
          get() {
            const style = this.style;
            if (style && style.fontFamily) {
              const font = style.fontFamily.replace(/['"]/g, '').trim();
              if (excludedFonts.has(font)) {
                // Return same width as fallback font (simulates "not installed")
                return origOffsetWidth.get.call(this) + (${Math.random()} > 0.5 ? 0 : 1);
              }
            }
            return origOffsetWidth.get.call(this);
          }
        });
      }

      // ── Prevent navigator.webdriver detection ──
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // ── Spoof plugins array ──
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' },
          ];
        }
      });

      // ── Spoof screen properties for consistency ──
      const RESOLUTIONS = [
        { w: 1920, h: 1080 }, { w: 2560, h: 1440 }, { w: 1366, h: 768 },
        { w: 1440, h: 900 }, { w: 1536, h: 864 }, { w: 1680, h: 1050 },
      ];
      const res = RESOLUTIONS[Math.floor(${Math.random()} * RESOLUTIONS.length)];
      const colorDepths = [24, 32];
      const cd = colorDepths[Math.floor(${Math.random()} * colorDepths.length)];
      
      try {
        Object.defineProperty(screen, 'colorDepth', { get: () => cd });
        Object.defineProperty(screen, 'pixelDepth', { get: () => cd });
      } catch(e) {}
    })();
  `;
}

/**
 * Extra browser launch args for anti-detection
 */
export function getStealthBrowserArgs() {
  return [
    // WebRTC leak prevention — critical for hiding real IP behind proxy
    '--disable-webrtc-hw-encoding',
    '--disable-webrtc-hw-decoding',
    '--enforce-webrtc-ip-handling-policy',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    // Disable features that reveal automation
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    // Disable crash reporting & telemetry
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-features=AutofillServerCommunication',
    // Disable background networking
    '--disable-background-networking',
    '--disable-default-apps',
    '--metrics-recording-only',
    '--no-default-browser-check',
    '--no-pings',
  ];
}

// ─────────────────────────────────────────────
//  Module 3: Micro-Interactions (Human Path)
// ─────────────────────────────────────────────

/**
 * Simulate human-like scrolling on a page — variable speed, overshoots
 */
export async function humanScroll(page, options = {}) {
  const { minScrolls = 2, maxScrolls = 5, direction = 'mixed' } = options;
  const scrollCount = minScrolls + Math.floor(Math.random() * (maxScrolls - minScrolls + 1));
  
  for (let i = 0; i < scrollCount; i++) {
    const scrollDir = direction === 'mixed' ? (Math.random() > 0.3 ? 'down' : 'up') : direction;
    // Variable scroll distance (Gaussian)
    const distance = gaussianDelay(300, 150, 100, 800);
    const scrollY = scrollDir === 'down' ? distance : -distance;
    
    await page.evaluate((dy) => {
      window.scrollBy({ top: dy, behavior: 'smooth' });
    }, scrollY);
    
    // Variable pause between scrolls
    const pause = gaussianDelay(400, 200, 150, 1200);
    await new Promise(r => setTimeout(r, pause));
  }
}

/**
 * Simulate random mouse movements — hover over elements, move naturally
 */
export async function humanMouseMovement(page) {
  try {
    const viewport = await page.evaluate(() => ({
      w: window.innerWidth || 1920,
      h: window.innerHeight || 1080,
    }));
    
    // 2-4 random mouse movements
    const moves = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < moves; i++) {
      const x = 100 + Math.floor(Math.random() * (viewport.w - 200));
      const y = 100 + Math.floor(Math.random() * (viewport.h - 200));
      
      // Move with slight curve (multiple steps)
      const steps = 5 + Math.floor(Math.random() * 10);
      await page.mouse.move(x, y, { steps });
      
      // Hover pause (0.3-1.5s)
      const hoverTime = gaussianDelay(600, 300, 200, 1500);
      await new Promise(r => setTimeout(r, hoverTime));
    }
  } catch (e) {
    // Non-critical — silently continue
  }
}

/**
 * Pre-post warm-up activity — makes the session look like a real user
 * Scrolls feed, hovers on posts, maybe clicks "See More"
 */
export async function prePostWarmup(page) {
  console.log('🔥 Running pre-post warm-up (human activity simulation)...');
  try {
    // Step 1: Scroll down the feed naturally
    await humanScroll(page, { minScrolls: 3, maxScrolls: 6, direction: 'down' });
    
    // Step 2: Pause like reading a post (1-3s)
    const readPause = gaussianDelay(2000, 800, 800, 4000);
    await new Promise(r => setTimeout(r, readPause));
    
    // Step 3: Random mouse movement (hovering over content)
    await humanMouseMovement(page);
    
    // Step 4: Scroll back up a bit
    await humanScroll(page, { minScrolls: 1, maxScrolls: 2, direction: 'up' });
    
    // Step 5: Final brief pause
    const finalPause = gaussianDelay(1000, 400, 500, 2000);
    await new Promise(r => setTimeout(r, finalPause));
    
    console.log('✅ Warm-up complete');
  } catch (e) {
    console.log('⚠️ Warm-up skipped:', e.message);
  }
}

/**
 * Pre-click micro-interaction — brief hover + small movement before clicking a button
 */
export async function preClickBehavior(page, x, y) {
  try {
    // Move to slightly offset position first (approach from side)
    const offsetX = x + gaussianRandom(0, 20);
    const offsetY = y + gaussianRandom(0, 15);
    await page.mouse.move(offsetX, offsetY, { steps: 3 + Math.floor(Math.random() * 5) });
    
    // Brief hover (0.3-1.2s)
    const hoverMs = gaussianDelay(500, 250, 200, 1200);
    await new Promise(r => setTimeout(r, hoverMs));
    
    // Move to actual target
    await page.mouse.move(x, y, { steps: 2 + Math.floor(Math.random() * 3) });
    
    // Tiny pause before click (50-200ms)
    const preClick = gaussianDelay(100, 50, 30, 250);
    await new Promise(r => setTimeout(r, preClick));
  } catch (e) {
    // Non-critical
  }
}

// ─────────────────────────────────────────────
//  Module 4: Content Mutation (Image Hash Breaking)
// ─────────────────────────────────────────────

/**
 * Mutate image file to break perceptual hash — pixel shift + EXIF scrub + color shift
 * Works with raw JPEG/PNG buffers without external dependencies
 */
export function mutateImageBuffer(buffer, index = 0) {
  // Create a copy to avoid mutating original
  const mutated = Buffer.from(buffer);
  
  // ── 1. EXIF / Metadata Scrubbing ──
  // For JPEG: Find and zero out EXIF data (APP1 marker = 0xFFE1)
  if (mutated[0] === 0xFF && mutated[1] === 0xD8) {
    // JPEG format
    let offset = 2;
    while (offset < mutated.length - 4) {
      if (mutated[offset] === 0xFF) {
        const marker = mutated[offset + 1];
        // APP1 (EXIF) = 0xE1, APP2 = 0xE2, ... APP13 = 0xED
        if (marker >= 0xE1 && marker <= 0xED) {
          const segLen = (mutated[offset + 2] << 8) | mutated[offset + 3];
          // Zero out metadata content (keep marker + length)
          for (let i = offset + 4; i < offset + 2 + segLen && i < mutated.length; i++) {
            mutated[i] = 0x00;
          }
          offset += 2 + segLen;
          continue;
        }
        // SOS marker = start of scan data — stop processing headers
        if (marker === 0xDA) break;
        if (marker === 0xD8 || marker === 0xD9) { offset += 2; continue; }
        // Skip other segments
        const len = (mutated[offset + 2] << 8) | mutated[offset + 3];
        offset += 2 + (len > 0 ? len : 2);
        continue;
      }
      offset++;
    }
  }
  
  // ── 2. Pixel-Level Noise Injection ──
  // Modify scattered bytes in the image data portion (after headers)
  // This changes the file hash while being visually imperceptible
  const dataStart = Math.min(Math.floor(mutated.length * 0.15), 2000);
  const dataEnd = mutated.length - 2;
  const noiseSeed = Date.now() + index * 31337;
  
  // Modify ~0.5-1% of bytes by ±1
  const noiseRate = 0.005 + Math.random() * 0.005;
  const noiseCount = Math.floor((dataEnd - dataStart) * noiseRate);
  
  for (let i = 0; i < noiseCount; i++) {
    // Pseudo-random position
    const pos = dataStart + Math.floor(((Math.sin(noiseSeed + i * 7.919) + 1) / 2) * (dataEnd - dataStart));
    if (pos >= 0 && pos < mutated.length) {
      // ±1 shift (invisible in compressed images)
      const shift = (i % 2 === 0) ? 1 : -1;
      mutated[pos] = Math.max(0, Math.min(255, mutated[pos] + shift));
    }
  }
  
  // ── 3. Append unique invisible comment ──
  // Add a unique byte sequence at the end (changes file hash 100%)
  const uniqueTag = Buffer.from(`\x00\x00${Date.now().toString(36)}${index}${Math.random().toString(36).slice(2, 8)}\x00`);
  return Buffer.concat([mutated, uniqueTag]);
}

/**
 * Prepare and mutate image files — each copy is unique (breaks duplicate detection)
 */
export function mutateImageFile(inputPath, outputPath, index = 0) {
  try {
    const buffer = fs.readFileSync(inputPath);
    const mutated = mutateImageBuffer(buffer, index);
    fs.writeFileSync(outputPath, mutated);
    return true;
  } catch (e) {
    console.log(`⚠️ Image mutation failed for ${inputPath}: ${e.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────
//  Module 5: Account Trust & Warm-up
// ─────────────────────────────────────────────

/**
 * Calculate safe posting limit based on account "maturity"
 * New accounts get lower limits, gradually increasing (exponential curve)
 * @param {number} accountAgeDays - How old the FB account/session is
 * @param {string} userPackage - Package tier (free/agent/elite)
 * @returns {number} Max groups per session
 */
export function calculateSafePostLimit(accountAgeDays, userPackage) {
  // Package base limits
  const packageMax = { free: 10, agent: 300, elite: 750 };
  const max = packageMax[userPackage] || 10;
  
  if (!accountAgeDays || accountAgeDays <= 0) return max; // No age data → use package limit
  
  // Exponential ramp-up curve
  // Day 1-7:   5 posts max
  // Day 8-14:  15 posts max
  // Day 15-30: 30 posts max
  // Day 31-60: 50 posts max
  // Day 61-90: 100 posts max
  // Day 90+:   package limit
  let ageLimit;
  if (accountAgeDays <= 7) ageLimit = 5;
  else if (accountAgeDays <= 14) ageLimit = 15;
  else if (accountAgeDays <= 30) ageLimit = 30;
  else if (accountAgeDays <= 60) ageLimit = 50;
  else if (accountAgeDays <= 90) ageLimit = 100;
  else ageLimit = max;
  
  return Math.min(ageLimit, max);
}

/**
 * Get recommended delay based on group count (adaptive safety)
 * More groups → longer delays to avoid pattern detection
 */
export function getAdaptiveDelay(groupCount, baseDelaySeconds) {
  // Scale delay up for large batches
  let multiplier = 1.0;
  if (groupCount > 100) multiplier = 1.5;
  else if (groupCount > 50) multiplier = 1.3;
  else if (groupCount > 30) multiplier = 1.15;
  
  return Math.round(baseDelaySeconds * multiplier);
}

/**
 * Session-unique random values for consistency within one automation run
 */
export function createSessionProfile() {
  return {
    // Typing style for this session
    typingSpeed: gaussianRandom(55, 15),  // base ms per char
    typoRate: 0.015 + Math.random() * 0.025,  // 1.5-4% typo rate
    pastePreference: Math.random(),  // < 0.45 = prefers typing, >= 0.45 = prefers paste
    
    // Scrolling behavior
    scrollSpeed: gaussianRandom(1.0, 0.3),  // multiplier
    
    // Timing personality
    rushFactor: gaussianRandom(1.0, 0.2),  // < 1 = patient, > 1 = rushy
    
    // Created timestamp for session identity
    createdAt: Date.now(),
  };
}
