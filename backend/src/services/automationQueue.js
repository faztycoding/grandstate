/**
 * AutomationQueue — จัดคิว Automation บน VPS ให้ไม่หนักเกินไป
 * 
 * ปัญหา: ถ้า 10 คนกด automation พร้อมกัน = 10 browsers + 30 tabs = VPS ล่ม
 * 
 * แก้: จำกัดจำนวน automation ที่รันพร้อมกัน (MAX_CONCURRENT)
 * - คนที่ 1-3 → รันทันที
 * - คนที่ 4+ → เข้าคิว (FIFO) รอจนมีช่องว่าง
 * - เมื่อ automation เสร็จ → คิวถัดไปเริ่มอัตโนมัติ
 * - ผู้ใช้เห็นตำแหน่งคิวและเวลาโดยประมาณ
 * 
 * v2 Improvements:
 * - History persisted to disk (survives server restart)
 * - Separate wait estimates for group vs marketplace automation
 * - Safe _onJobComplete (no-op if user not in running)
 * - Notification system: frontend can poll for "your turn" alerts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AUTOMATIONS || '10', 10);
const QUEUE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min max wait in queue
const HISTORY_FILE = path.join(__dirname, '../../data/queue-history.json');
const MAX_HISTORY = 100;

class AutomationQueue {
  constructor() {
    this.running = new Map();   // userId -> { startedAt, groupCount, automationType, ... }
    this.queue = [];            // [{ userId, config, resolve, reject, enqueuedAt, automationType }]
    this.history = [];          // persisted completed jobs
    this.maxConcurrent = MAX_CONCURRENT;

    // Notification map: userId -> { type, message, timestamp }
    // Entries are consumed (deleted) when polled by the user
    this.notifications = new Map();

    // Load persisted history
    this._loadHistory();

    // Cleanup stale queue entries every 60s
    this._cleanupTimer = setInterval(() => this._cleanupStaleEntries(), 60_000);

    // Persist history every 5 min (debounced — also saved on each job complete)
    this._persistTimer = setInterval(() => this._saveHistory(), 5 * 60_000);
  }

  // ─── Persistence ───────────────────────────────────────────────

  _loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.history = data.slice(-MAX_HISTORY);
          console.log(`📂 [Queue] Loaded ${this.history.length} history records from disk`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [Queue] Could not load history:', err.message);
    }
  }

  _saveHistory() {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history.slice(-MAX_HISTORY), null, 2));
    } catch (err) {
      console.warn('⚠️ [Queue] Could not save history:', err.message);
    }
  }

  // ─── Core Queue Logic ──────────────────────────────────────────

  /**
   * Try to start automation immediately, or enqueue if at capacity
   * @param {string} userId
   * @param {Function} automationFn
   * @param {object} config
   * @param {object} extraContext - { worker, displayName, automationType: 'group'|'marketplace' }
   */
  async tryStartOrEnqueue(userId, automationFn, config, extraContext = {}) {
    const automationType = extraContext.automationType || 'group';

    // Run cleanup FIRST to clear any ghost/stale entries before any checks
    this._cleanupStaleEntries();

    // If this user already has a running automation, reject
    if (this.running.has(userId)) {
      throw new Error('คุณมี Automation กำลังทำงานอยู่แล้ว กรุณารอให้เสร็จก่อน');
    }

    // If this user is already in queue, return current position
    const existingIdx = this.queue.findIndex(q => q.userId === userId);
    if (existingIdx >= 0) {
      const pos = existingIdx + 1;
      return {
        queued: true,
        position: pos,
        estimatedWaitSec: this._estimateWait(pos, automationType),
      };
    }

    // If there's capacity → run immediately
    if (this.running.size < this.maxConcurrent) {
      this._startJob(userId, automationFn, config, { ...extraContext, automationType });
      return { queued: false };
    }

    console.log(`⚠️ [Queue] No capacity for ${userId.substring(0, 8)}: running=${this.running.size}/${this.maxConcurrent}, running users: [${Array.from(this.running.keys()).map(k => k.substring(0, 8)).join(', ')}]`);

    // Otherwise → enqueue
    return new Promise((resolve) => {
      const entry = {
        userId,
        automationFn,
        config,
        extraContext: { ...extraContext, automationType },
        enqueuedAt: Date.now(),
        automationType,
      };
      this.queue.push(entry);

      const position = this.queue.length;
      console.log(`📋 [Queue] User ${userId.substring(0, 8)} enqueued at position ${position} (${this.running.size}/${this.maxConcurrent} running, type=${automationType})`);

      // Resolve immediately with queue position info
      resolve({
        queued: true,
        position,
        estimatedWaitSec: this._estimateWait(position, automationType),
      });
    });
  }

  /**
   * Internal: start a job and track it
   */
  _startJob(userId, automationFn, config, extraContext = {}) {
    const automationType = extraContext.automationType || 'group';
    const jobInfo = {
      userId,
      startedAt: Date.now(),
      groupCount: config.groups?.length || 0,
      worker: extraContext.worker,
      displayName: extraContext.displayName,
      email: extraContext.email || null,
      fbAccount: extraContext.fbAccount || null,
      propertyTitle: extraContext.propertyTitle || null,
      automationType,
    };
    this.running.set(userId, jobInfo);

    const shortId = userId.substring(0, 8);
    console.log(`▶️ [Queue] Starting ${automationType} automation for ${shortId} (${this.running.size}/${this.maxConcurrent} slots used)`);

    // Run the automation and handle completion
    automationFn(config)
      .then(result => {
        console.log(`✅ [Queue] ${shortId} finished: ${result?.success ? 'SUCCESS' : 'FAILED'}`);
        this._onJobComplete(userId, true);
      })
      .catch(err => {
        console.error(`❌ [Queue] ${shortId} error:`, err.message);
        this._onJobComplete(userId, false);
      });
  }

  /**
   * Called when any job finishes — remove from running, start next in queue
   * Safe: no-op if userId is not in the running map
   */
  _onJobComplete(userId, success) {
    const job = this.running.get(userId);
    if (!job) {
      // Guard: user was already removed (e.g. stop was called while not running)
      return;
    }

    // Extract per-task stats from worker before removing
    let taskStats = { completed: 0, failed: 0, pendingApproval: 0, total: job.groupCount };
    if (job.worker && typeof job.worker.getStatus === 'function') {
      try {
        const st = job.worker.getStatus();
        if (Array.isArray(st.tasks)) {
          taskStats.completed = st.tasks.filter(t => t.status === 'completed').length;
          taskStats.failed = st.tasks.filter(t => t.status === 'failed' || t.status === 'error').length;
          taskStats.pendingApproval = st.tasks.filter(t => t.status === 'pending_approval').length;
          taskStats.total = st.tasks.length;
        }
      } catch (_) { /* ignore */ }
    }

    const record = {
      userId: userId.substring(0, 8) + '...',
      fullUserId: userId,
      displayName: job.displayName || userId.substring(0, 8),
      groupCount: job.groupCount,
      durationSec: Math.round((Date.now() - job.startedAt) / 1000),
      success,
      completedAt: Date.now(),
      automationType: job.automationType || 'group',
      taskStats,
    };
    this.history.push(record);

    // Keep last MAX_HISTORY
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    this.running.delete(userId);

    // Persist history to disk immediately after each completion
    this._saveHistory();

    // Process next in queue
    this._processNext();
  }

  /**
   * Try to start the next queued job(s)
   */
  _processNext() {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const next = this.queue.shift();
      if (!next) break;

      const shortId = next.userId.substring(0, 8);

      // Skip if timed out
      if (Date.now() - next.enqueuedAt > QUEUE_TIMEOUT_MS) {
        console.log(`⏰ [Queue] ${shortId} timed out in queue, skipping`);
        // Notify user that their queue entry timed out
        this._pushNotification(next.userId, 'queue_timeout', 'คิวของคุณหมดเวลา กรุณาลองใหม่อีกครั้ง');
        continue;
      }

      console.log(`📋 [Queue] Dequeuing ${shortId}, starting automation...`);

      // Push "your turn" notification
      this._pushNotification(next.userId, 'queue_ready', '🚀 ถึงคิวคุณแล้ว! กำลังเริ่ม Automation อัตโนมัติ...');

      this._startJob(next.userId, next.automationFn, next.config, next.extraContext);
    }
  }

  // ─── Wait Estimation (separated by automation type) ────────────

  /**
   * Estimate wait time based on average job duration and queue position
   * Now factors in automationType for more accurate estimates
   */
  _estimateWait(position, automationType = 'group') {
    // Filter history by automation type for better accuracy
    const typeHistory = this.history.filter(h => (h.automationType || 'group') === automationType);
    const allHistory = this.history;

    let avgDurationSec = 300; // default 5 min

    // Prefer type-specific average if enough data
    if (typeHistory.length >= 3) {
      const recent = typeHistory.slice(-10);
      avgDurationSec = Math.round(
        recent.reduce((sum, h) => sum + h.durationSec, 0) / recent.length
      );
    } else if (allHistory.length >= 3) {
      // Fallback to overall average
      const recent = allHistory.slice(-10);
      avgDurationSec = Math.round(
        recent.reduce((sum, h) => sum + h.durationSec, 0) / recent.length
      );
    }

    // How many "waves" until this position runs
    const waves = Math.ceil(position / this.maxConcurrent);
    return waves * avgDurationSec;
  }

  // ─── Notification System ───────────────────────────────────────

  /**
   * Push a notification for a user (consumed on poll)
   */
  _pushNotification(userId, type, message) {
    this.notifications.set(userId, {
      type,
      message,
      timestamp: Date.now(),
    });
    console.log(`🔔 [Queue] Notification for ${userId.substring(0, 8)}: ${type}`);
  }

  /**
   * Poll and consume notification for a user
   * Returns notification object or null
   */
  pollNotification(userId) {
    const notif = this.notifications.get(userId);
    if (notif) {
      this.notifications.delete(userId);
      return notif;
    }
    return null;
  }

  // ─── Queue Management ─────────────────────────────────────────

  /**
   * Remove user from queue (e.g., they cancelled)
   */
  cancelQueue(userId) {
    const idx = this.queue.findIndex(q => q.userId === userId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      console.log(`🚫 [Queue] ${userId.substring(0, 8)} removed from queue`);
      return true;
    }
    return false;
  }

  /**
   * Remove stale entries from both queue AND running map
   */
  _cleanupStaleEntries() {
    const now = Date.now();
    const RUNNING_HARD_TIMEOUT_MS = 45 * 60 * 1000; // 45 min hard limit
    const BROWSER_GHOST_TIMEOUT_MS = 5 * 60 * 1000; // 5 min: if worker says running but no browser = ghost

    // 1. Clean stale queue entries
    const before = this.queue.length;
    this.queue = this.queue.filter(q => (now - q.enqueuedAt) < QUEUE_TIMEOUT_MS);
    const removedQueue = before - this.queue.length;
    if (removedQueue > 0) {
      console.log(`🧹 [Queue] Removed ${removedQueue} stale queue entries`);
    }

    // 2. AGGRESSIVE ghost cleanup — multiple detection strategies
    const staleRunning = [];
    for (const [uid, job] of this.running.entries()) {
      const elapsedMs = now - job.startedAt;
      const worker = job.worker;

      // Strategy A: worker.isRunning is explicitly false
      const workerSaysRunning = worker && (typeof worker.isRunning !== 'undefined' ? worker.isRunning : true);
      if (!workerSaysRunning) {
        staleRunning.push({ uid, reason: 'worker.isRunning=false but slot not freed' });
        continue;
      }

      // Strategy B: browser disconnected (crashed/closed) but worker still claims running
      const browserConnected = worker && worker.browser && typeof worker.browser.isConnected === 'function' && worker.browser.isConnected();
      if (worker && !browserConnected && elapsedMs > BROWSER_GHOST_TIMEOUT_MS) {
        staleRunning.push({ uid, reason: `browser disconnected for ${Math.round(elapsedMs / 60000)}m — ghost` });
        continue;
      }

      // Strategy C: hard timeout exceeded
      if (elapsedMs > RUNNING_HARD_TIMEOUT_MS) {
        staleRunning.push({ uid, reason: `exceeded ${Math.round(RUNNING_HARD_TIMEOUT_MS / 60000)}m hard timeout` });
        continue;
      }

      // Strategy D: worker has no tasks and has been "running" for > 3 min (startup ghost)
      if (worker && Array.isArray(worker.tasks) && worker.tasks.length === 0 && elapsedMs > 3 * 60 * 1000) {
        staleRunning.push({ uid, reason: 'running >3m with zero tasks — startup ghost' });
        continue;
      }
    }

    for (const { uid, reason } of staleRunning) {
      console.log(`🧹 [Queue] Removing ghost running entry: ${uid.substring(0, 8)} — ${reason}`);
      this._onJobComplete(uid, false);
    }

    // 3. Clean old notifications (> 5 min)
    for (const [uid, notif] of this.notifications.entries()) {
      if (now - notif.timestamp > 5 * 60_000) {
        this.notifications.delete(uid);
      }
    }
  }

  // ─── History Management ────────────────────────────────────────

  /**
   * Clear job history — type: 'all' | 'success' | 'failed'
   * Returns the number of records removed
   */
  clearHistory(type = 'all') {
    const before = this.history.length;
    if (type === 'all') {
      this.history = [];
    } else if (type === 'success') {
      this.history = this.history.filter(h => !h.success);
    } else if (type === 'failed') {
      this.history = this.history.filter(h => h.success);
    }
    const removed = before - this.history.length;
    this._saveHistory();
    console.log(`🗑️ [Queue] Cleared ${removed} history records (type=${type})`);
    return removed;
  }

  // ─── Status APIs ──────────────────────────────────────────────

  /**
   * Get queue status for a specific user (includes notification)
   */
  getUserQueueStatus(userId) {
    // Run cleanup FIRST to free ghost slots
    this._cleanupStaleEntries();

    // Check for pending notification
    const notification = this.pollNotification(userId);

    // Currently running?
    if (this.running.has(userId)) {
      return {
        status: 'running',
        position: 0,
        estimatedWaitSec: 0,
        notification,
        capacity: { running: this.running.size, max: this.maxConcurrent },
      };
    }

    // In queue?
    const idx = this.queue.findIndex(q => q.userId === userId);
    if (idx >= 0) {
      const position = idx + 1;
      const automationType = this.queue[idx].automationType || 'group';
      const now = Date.now();

      // Build running jobs summary (for showing who's ahead)
      const runningJobs = Array.from(this.running.values()).map(job => ({
        displayName: job.displayName || 'User',
        groupCount: job.groupCount,
        runningSec: Math.round((now - job.startedAt) / 1000),
        automationType: job.automationType || 'group',
      }));

      return {
        status: 'queued',
        position,
        estimatedWaitSec: this._estimateWait(position, automationType),
        notification,
        capacity: { running: this.running.size, max: this.maxConcurrent },
        runningJobs,
        queueAhead: idx, // how many people waiting before this user
      };
    }

    // Not in system
    return {
      status: 'idle',
      position: null,
      estimatedWaitSec: 0,
      notification,
      capacity: { running: this.running.size, max: this.maxConcurrent },
    };
  }

  /**
   * Full queue stats for admin panel
   */
  getQueueStats() {
    const now = Date.now();
    const successJobs = this.history.filter(h => h.success);
    const failedJobs = this.history.filter(h => !h.success);
    const avgDuration = this.history.length > 0
      ? Math.round(this.history.reduce((s, h) => s + h.durationSec, 0) / this.history.length)
      : 0;

    return {
      maxConcurrent: this.maxConcurrent,
      runningCount: this.running.size,
      queueLength: this.queue.length,
      queueTimeoutMin: Math.round(QUEUE_TIMEOUT_MS / 60000),
      // Running jobs detail
      running: Array.from(this.running.entries()).map(([uid, info]) => {
        let status = null;
        if (info.worker && typeof info.worker.getStatus === 'function') {
          status = info.worker.getStatus();
        }
        let latestLog = null;
        if (status && Array.isArray(status.logs) && status.logs.length > 0) {
          latestLog = status.logs[0];
          if (status.logs.length > 1 && new Date(status.logs[status.logs.length - 1].time) > new Date(status.logs[0].time)) {
            latestLog = status.logs[status.logs.length - 1];
          }
        }
        // Get real anti-detection status from worker
        let antiDetection = null;
        if (info.worker && typeof info.worker.getAntiDetectionStatus === 'function') {
          antiDetection = info.worker.getAntiDetectionStatus();
        }

        // Get recent logs for admin inspection
        let recentLogs = [];
        if (status && Array.isArray(status.logs)) {
          recentLogs = status.logs.slice(-50).map(l => ({
            time: l.time,
            msg: l.msg,
            level: l.level || 'info',
          }));
        }

        return {
          userId: uid.substring(0, 8) + '...',
          fullUserId: uid,
          displayName: info.displayName || uid.substring(0, 8),
          email: info.email || null,
          fbAccount: info.fbAccount || null,
          propertyTitle: info.propertyTitle || null,
          groupCount: info.groupCount,
          startedAt: info.startedAt,
          runningSec: Math.round((now - info.startedAt) / 1000),
          automationType: info.automationType || 'group',
          progress: status ? {
            currentStep: status.currentStep,
            totalSteps: status.totalSteps,
            isPaused: status.isPaused,
            latestLog: latestLog,
          } : null,
          antiDetection,
          logs: recentLogs,
        };
      }),
      // Waiting queue detail
      queue: this.queue.map((q, i) => ({
        position: i + 1,
        userId: q.userId.substring(0, 8) + '...',
        fullUserId: q.userId,
        displayName: q.extraContext?.displayName || q.userId.substring(0, 8),
        groupCount: q.config?.groups?.length || 0,
        enqueuedAt: q.enqueuedAt,
        waitingSec: Math.round((now - q.enqueuedAt) / 1000),
        estimatedWaitSec: this._estimateWait(i + 1, q.automationType || 'group'),
        automationType: q.automationType || 'group',
      })),
      // Aggregate stats
      stats: {
        totalCompleted: successJobs.length,
        totalFailed: failedJobs.length,
        totalProcessed: this.history.length,
        successRate: this.history.length > 0
          ? Math.round((successJobs.length / this.history.length) * 100)
          : 0,
        avgDurationSec: avgDuration,
        avgDurationFormatted: avgDuration > 0
          ? `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`
          : '—',
        longestJobSec: this.history.length > 0
          ? Math.max(...this.history.map(h => h.durationSec))
          : 0,
        shortestJobSec: this.history.length > 0
          ? Math.min(...this.history.map(h => h.durationSec))
          : 0,
      },
      // Recent history (last 20)
      recentHistory: this.history.slice(-20).reverse().map(h => ({
        ...h,
        completedAtFormatted: new Date(h.completedAt).toLocaleTimeString('th-TH', { hour12: false }),
        completedAtFull: new Date(h.completedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        durationFormatted: `${Math.floor(h.durationSec / 60)}:${String(h.durationSec % 60).padStart(2, '0')}`,
      })),
    };
  }
}

export const automationQueue = new AutomationQueue();
