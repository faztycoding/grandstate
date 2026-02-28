/**
 * Scheduled Posting Service
 * - Stores scheduled jobs in a JSON file
 * - Checks every 30 seconds for due jobs
 * - Triggers group or marketplace automation when time arrives
 */

import fs from 'fs';
import path from 'path';

export class PostScheduler {
  constructor(userId = 'default') {
    this.userId = userId;
    this.scheduleFile = path.join(process.cwd(), 'data', userId, 'scheduled-posts.json');
    this.schedules = this._loadSchedules();
    this.timer = null;
    this.onTrigger = null; // callback set by index.js
  }

  _ensureDataDir() {
    const dir = path.dirname(this.scheduleFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _loadSchedules() {
    this._ensureDataDir();
    try {
      if (fs.existsSync(this.scheduleFile)) {
        const data = fs.readFileSync(this.scheduleFile, 'utf-8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.error('❌ Error loading schedules:', err.message);
    }
    return [];
  }

  _saveSchedules() {
    this._ensureDataDir();
    fs.writeFileSync(this.scheduleFile, JSON.stringify(this.schedules, null, 2), 'utf-8');
  }

  start(onTrigger) {
    this.onTrigger = onTrigger;
    this.timer = setInterval(() => this.checkDueJobs(), 30000);
    console.log('⏰ Scheduler started — checking every 30s');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  addSchedule(config) {
    const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const schedule = {
      id,
      status: 'pending', // pending | running | completed | failed | cancelled
      createdAt: new Date().toISOString(),
      scheduledAt: config.scheduledAt, // ISO string
      mode: config.mode, // 'group' | 'marketplace'
      property: config.property,
      groups: config.groups,
      caption: config.caption,
      images: config.images || [],
      delaySeconds: config.delaySeconds || 20,
      captionStyle: config.captionStyle || 'friendly',
      userPackage: config.userPackage || 'free',
      browser: config.browser || 'chrome',
      fbSlot: config.fbSlot ?? 0,
      fbAccountName: config.fbAccountName || null,
      result: null,
    };
    this.schedules.push(schedule);
    this._saveSchedules();
    console.log(`⏰ Scheduled: ${id} at ${config.scheduledAt} (${config.mode}, ${config.groups?.length} groups)`);
    return schedule;
  }

  cancelSchedule(id) {
    const idx = this.schedules.findIndex(s => s.id === id);
    if (idx === -1) return false;
    if (this.schedules[idx].status !== 'pending') return false;
    this.schedules[idx].status = 'cancelled';
    this._saveSchedules();
    return true;
  }

  deleteSchedule(id) {
    const idx = this.schedules.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.schedules.splice(idx, 1);
    this._saveSchedules();
    return true;
  }

  getSchedules() {
    return this.schedules;
  }

  getPendingSchedules() {
    return this.schedules.filter(s => s.status === 'pending');
  }

  /**
   * Pre-flight check callback — set by userSessionManager
   * Returns { ok, error?, canRetry? } to verify browser/session health
   */
  setPreflightCheck(fn) {
    this._preflightCheck = fn;
  }

  async checkDueJobs() {
    const now = new Date();
    const pending = this.schedules.filter(s => s.status === 'pending');

    // Clean up stale 'running' jobs older than 2 hours (stuck)
    for (const job of this.schedules) {
      if (job.status === 'running') {
        const runningFor = now - new Date(job.scheduledAt);
        if (runningFor > 2 * 60 * 60 * 1000) {
          console.log(`⏰ [${this.userId.substring(0, 8)}] Stale job ${job.id} — marking failed`);
          job.status = 'failed';
          job.result = { error: 'Job timed out (stuck > 2 hours)' };
          this._saveSchedules();
        }
      }
    }

    for (const job of pending) {
      const scheduledTime = new Date(job.scheduledAt);
      if (scheduledTime <= now) {
        const shortId = this.userId.substring(0, 8);
        console.log(`\n⏰ [${shortId}] TRIGGER: ${job.id} — ${job.mode} mode, ${job.groups?.length} groups`);

        // Pre-flight: check browser/session health before starting
        if (this._preflightCheck) {
          const preflight = await this._preflightCheck(job);
          if (!preflight.ok) {
            console.log(`⏰ [${shortId}] Pre-flight FAILED: ${preflight.error}`);

            // If recoverable, try once to re-initialize browser
            if (preflight.canRetry) {
              console.log(`⏰ [${shortId}] Attempting recovery...`);
              try {
                if (preflight.reinit) await preflight.reinit();
                const retry = await this._preflightCheck(job);
                if (!retry.ok) {
                  job.status = 'failed';
                  job.result = { error: `Pre-flight failed after retry: ${retry.error}` };
                  this._saveSchedules();
                  continue;
                }
                console.log(`⏰ [${shortId}] Recovery successful — proceeding`);
              } catch (recoverErr) {
                job.status = 'failed';
                job.result = { error: `Recovery failed: ${recoverErr.message}` };
                this._saveSchedules();
                continue;
              }
            } else {
              job.status = 'failed';
              job.result = { error: preflight.error };
              this._saveSchedules();
              continue;
            }
          }
        }

        job.status = 'running';
        job.startedAt = new Date().toISOString();
        this._saveSchedules();

        try {
          if (this.onTrigger) {
            const result = await this.onTrigger(job);

            // Check actual result from automation — don't blindly mark completed
            if (result && result.success === false) {
              // Automation returned failure (e.g. login_required, browser error)
              if (result.errorType === 'login_required' && !job._retried) {
                // Retry once: mark for retry, re-initialize, and try again
                console.log(`⏰ [${shortId}] Login required — retrying after browser re-init...`);
                job._retried = true;
                job.status = 'pending'; // Put back in queue for next cycle
                this._saveSchedules();
                continue;
              }
              job.status = 'failed';
              job.result = { error: result.error || result.message || 'Automation returned failure', tasks: result.tasks };
            } else {
              job.status = 'completed';
              job.result = result;
            }
          } else {
            job.status = 'failed';
            job.result = { error: 'No trigger callback registered' };
          }
        } catch (err) {
          console.error(`⏰ [${shortId}] Scheduled job error:`, err.message);

          // If browser crashed, retry once
          if (!job._retried && (err.message.includes('browser') || err.message.includes('Target closed') || err.message.includes('Session closed'))) {
            console.log(`⏰ [${shortId}] Browser crash detected — will retry next cycle`);
            job._retried = true;
            job.status = 'pending';
          } else {
            job.status = 'failed';
            job.result = { error: err.message };
          }
        }

        job.completedAt = new Date().toISOString();
        this._saveSchedules();
      }
    }
  }
}
