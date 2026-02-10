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

  async checkDueJobs() {
    const now = new Date();
    const pending = this.schedules.filter(s => s.status === 'pending');

    for (const job of pending) {
      const scheduledTime = new Date(job.scheduledAt);
      if (scheduledTime <= now) {
        console.log(`⏰ TRIGGER: ${job.id} — ${job.mode} mode, ${job.groups?.length} groups`);
        job.status = 'running';
        this._saveSchedules();

        try {
          if (this.onTrigger) {
            const result = await this.onTrigger(job);
            job.status = 'completed';
            job.result = result;
          } else {
            job.status = 'failed';
            job.result = { error: 'No trigger callback registered' };
          }
        } catch (err) {
          job.status = 'failed';
          job.result = { error: err.message };
        }

        this._saveSchedules();
      }
    }
  }
}
