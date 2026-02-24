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
 */

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AUTOMATIONS || '3', 10);
const QUEUE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min max wait in queue

class AutomationQueue {
  constructor() {
    this.running = new Map();   // userId -> { startedAt, groupCount, ... }
    this.queue = [];            // [{ userId, config, resolve, reject, enqueuedAt }]
    this.history = [];          // last 50 completed jobs for stats
    this.maxConcurrent = MAX_CONCURRENT;

    // Cleanup stale queue entries every 60s
    this._cleanupTimer = setInterval(() => this._cleanupStaleEntries(), 60_000);
  }

  /**
   * Try to start automation immediately, or enqueue if at capacity
   * Returns: { queued: boolean, position?: number, estimatedWaitSec?: number }
   * 
   * If queued=false → automation is starting now
   * If queued=true  → user must poll /api/group-automation/queue-status
   */
  async tryStartOrEnqueue(userId, automationFn, config) {
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
        estimatedWaitSec: this._estimateWait(pos),
      };
    }

    // If there's capacity → run immediately
    if (this.running.size < this.maxConcurrent) {
      this._startJob(userId, automationFn, config);
      return { queued: false };
    }

    // Otherwise → enqueue
    return new Promise((resolve, reject) => {
      const entry = {
        userId,
        automationFn,
        config,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };
      this.queue.push(entry);

      const position = this.queue.length;
      console.log(`📋 [Queue] User ${userId.substring(0, 8)} enqueued at position ${position} (${this.running.size}/${this.maxConcurrent} running)`);

      // Resolve immediately with queue position info
      // The actual automation will start when it's this user's turn
      resolve({
        queued: true,
        position,
        estimatedWaitSec: this._estimateWait(position),
      });
    });
  }

  /**
   * Internal: start a job and track it
   */
  _startJob(userId, automationFn, config) {
    const jobInfo = {
      userId,
      startedAt: Date.now(),
      groupCount: config.groups?.length || 0,
    };
    this.running.set(userId, jobInfo);

    const shortId = userId.substring(0, 8);
    console.log(`▶️ [Queue] Starting automation for ${shortId} (${this.running.size}/${this.maxConcurrent} slots used)`);

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
   */
  _onJobComplete(userId, success) {
    const job = this.running.get(userId);
    if (job) {
      this.history.push({
        userId: userId.substring(0, 8) + '...',
        groupCount: job.groupCount,
        durationSec: Math.round((Date.now() - job.startedAt) / 1000),
        success,
        completedAt: Date.now(),
      });
      // Keep last 50
      if (this.history.length > 50) this.history = this.history.slice(-50);
    }
    this.running.delete(userId);

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
        continue;
      }

      console.log(`📋 [Queue] Dequeuing ${shortId}, starting automation...`);
      this._startJob(next.userId, next.automationFn, next.config);
    }
  }

  /**
   * Estimate wait time based on average job duration and queue position
   */
  _estimateWait(position) {
    // Average duration from history, or default 5 min
    let avgDurationSec = 300;
    if (this.history.length >= 3) {
      const recent = this.history.slice(-10);
      avgDurationSec = Math.round(
        recent.reduce((sum, h) => sum + h.durationSec, 0) / recent.length
      );
    }

    // How many "waves" until this position runs
    const waves = Math.ceil(position / this.maxConcurrent);
    return waves * avgDurationSec;
  }

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
   * Remove stale entries that have been waiting too long
   */
  _cleanupStaleEntries() {
    const now = Date.now();
    const before = this.queue.length;
    this.queue = this.queue.filter(q => (now - q.enqueuedAt) < QUEUE_TIMEOUT_MS);
    const removed = before - this.queue.length;
    if (removed > 0) {
      console.log(`🧹 [Queue] Removed ${removed} stale queue entries`);
    }
  }

  /**
   * Get queue status for a specific user
   */
  getUserQueueStatus(userId) {
    // Currently running?
    if (this.running.has(userId)) {
      return {
        status: 'running',
        position: 0,
        estimatedWaitSec: 0,
      };
    }

    // In queue?
    const idx = this.queue.findIndex(q => q.userId === userId);
    if (idx >= 0) {
      const position = idx + 1;
      return {
        status: 'queued',
        position,
        estimatedWaitSec: this._estimateWait(position),
      };
    }

    // Not in system
    return {
      status: 'idle',
      position: null,
      estimatedWaitSec: 0,
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
      running: Array.from(this.running.entries()).map(([uid, info]) => ({
        userId: uid.substring(0, 8) + '...',
        fullUserId: uid,
        groupCount: info.groupCount,
        startedAt: info.startedAt,
        runningSec: Math.round((now - info.startedAt) / 1000),
      })),
      // Waiting queue detail
      queue: this.queue.map((q, i) => ({
        position: i + 1,
        userId: q.userId.substring(0, 8) + '...',
        fullUserId: q.userId,
        groupCount: q.config?.groups?.length || 0,
        enqueuedAt: q.enqueuedAt,
        waitingSec: Math.round((now - q.enqueuedAt) / 1000),
        estimatedWaitSec: this._estimateWait(i + 1),
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
        durationFormatted: `${Math.floor(h.durationSec / 60)}:${String(h.durationSec % 60).padStart(2, '0')}`,
      })),
    };
  }
}

export const automationQueue = new AutomationQueue();
