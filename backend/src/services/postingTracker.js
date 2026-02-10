import fs from 'fs';
import path from 'path';

/**
 * PostingTracker v2 — ระบบติดตามการโพสต์ + Daily Limit Reset 05:00 AM
 * 
 * Features:
 * 1. Daily cycle reset ทุก 05:00 AM (limit โพสต์รีเซ็ตวันใหม่)
 * 2. ป้องกันโพสต์ซ้ำ — เช็ค property+group cooldown
 * 3. บันทึกประวัติการโพสต์ + สถิติรายวัน
 * 4. Package limit enforcement (free: 10, agent: 300, elite: 750)
 * 5. รองรับ automation run tracking (รอบที่เท่าไหร่ของวัน)
 */

const DAILY_RESET_HOUR = 5; // 05:00 AM
const PACKAGE_LIMITS = { free: 10, agent: 300, elite: 750 };

export class PostingTracker {
  constructor(userId = 'default') {
    this.userId = userId;
    this.dataPath = path.join(process.cwd(), 'data', userId, 'posting-history.json');
    this.history = this.loadHistory();
    this.checkDailyReset();
  }

  // ============================================
  // DAILY CYCLE — Reset at 05:00 AM
  // ============================================

  /**
   * คำนวณ "วัน" ปัจจุบันตามเวลา reset 05:00 AM
   * ถ้าเวลา 04:59 → ยังนับเป็นวันก่อน
   * ถ้าเวลา 05:01 → นับเป็นวันใหม่
   */
  getCurrentDay() {
    const now = new Date();
    const adjusted = new Date(now);
    adjusted.setHours(adjusted.getHours() - DAILY_RESET_HOUR);
    return adjusted.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * คำนวณเวลา reset ถัดไป
   */
  getNextResetTime() {
    const now = new Date();
    const reset = new Date(now);
    reset.setHours(DAILY_RESET_HOUR, 0, 0, 0);
    if (now >= reset) {
      reset.setDate(reset.getDate() + 1);
    }
    return reset;
  }

  /**
   * เช็คว่าถึงเวลา reset หรือยัง — ถ้าใช่ reset daily counters
   */
  checkDailyReset() {
    const currentDay = this.getCurrentDay();
    const lastDay = this.history.currentDay;

    if (lastDay !== currentDay) {
      console.log(`\n🔄 DAILY RESET: ${lastDay || 'first-run'} → ${currentDay}`);
      console.log(`   Reset time: Every day at ${DAILY_RESET_HOUR}:00 AM`);

      // Archive yesterday's stats
      if (lastDay && this.history.todayStats) {
        if (!this.history.dailyArchive) this.history.dailyArchive = {};
        this.history.dailyArchive[lastDay] = { ...this.history.todayStats };
        // Keep only last 30 days
        const keys = Object.keys(this.history.dailyArchive).sort();
        while (keys.length > 30) {
          delete this.history.dailyArchive[keys.shift()];
        }
      }

      // Reset today's stats
      this.history.currentDay = currentDay;
      this.history.todayStats = {
        postsCount: 0,
        successCount: 0,
        failedCount: 0,
        skippedDuplicate: 0,
        groupsPosted: [],     // groupIds posted today
        propertiesPosted: [], // propertyIds posted today
        automationRuns: 0,    // จำนวนรอบ automation วันนี้
        firstPostAt: null,
        lastPostAt: null,
        batches: [],          // [{batchNum, groupCount, successCount, timestamp}]
      };

      this.saveHistory();
    }
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  loadHistory() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf-8');
        const parsed = JSON.parse(data);
        // Ensure all required fields exist
        return {
          postings: parsed.postings || [],
          groupStats: parsed.groupStats || {},
          propertyStats: parsed.propertyStats || {},
          currentDay: parsed.currentDay || null,
          todayStats: parsed.todayStats || null,
          dailyArchive: parsed.dailyArchive || {},
        };
      }
    } catch (error) {
      console.error('Error loading posting history:', error);
    }
    return {
      postings: [],
      groupStats: {},
      propertyStats: {},
      currentDay: null,
      todayStats: null,
      dailyArchive: {},
    };
  }

  saveHistory() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('Error saving posting history:', error);
    }
  }

  // ============================================
  // PACKAGE LIMIT
  // ============================================

  /**
   * เช็คว่าวันนี้โพสต์ได้อีกกี่ครั้ง
   */
  getRemainingPosts(userPackage = 'free') {
    this.checkDailyReset();
    const limit = PACKAGE_LIMITS[userPackage] || PACKAGE_LIMITS.free;
    const used = this.history.todayStats?.postsCount || 0;
    return Math.max(0, limit - used);
  }

  /**
   * เช็คว่าวันนี้โพสต์ได้อีกไหม
   */
  canPostToday(userPackage = 'free', requestedCount = 1) {
    return this.getRemainingPosts(userPackage) >= requestedCount;
  }

  /**
   * ดึงสถิติวันนี้
   */
  getTodayStats(userPackage = 'free') {
    this.checkDailyReset();
    const limit = PACKAGE_LIMITS[userPackage] || PACKAGE_LIMITS.free;
    const stats = this.history.todayStats || {};
    const nextReset = this.getNextResetTime();

    return {
      date: this.history.currentDay,
      postsCount: stats.postsCount || 0,
      successCount: stats.successCount || 0,
      failedCount: stats.failedCount || 0,
      skippedDuplicate: stats.skippedDuplicate || 0,
      limit,
      remaining: Math.max(0, limit - (stats.postsCount || 0)),
      usagePercent: Math.min(100, Math.round(((stats.postsCount || 0) / limit) * 100)),
      automationRuns: stats.automationRuns || 0,
      groupsPosted: stats.groupsPosted || [],
      propertiesPosted: stats.propertiesPosted || [],
      firstPostAt: stats.firstPostAt,
      lastPostAt: stats.lastPostAt,
      batches: stats.batches || [],
      nextResetAt: nextReset.toISOString(),
      nextResetIn: this.formatDuration(nextReset - new Date()),
    };
  }

  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} ชม. ${minutes} นาที`;
  }

  // ============================================
  // RECORD POSTING
  // ============================================

  /**
   * บันทึกการโพสต์ 1 รายการ
   */
  recordPosting(propertyId, groupId, groupName = '', success = true) {
    this.checkDailyReset();
    const timestamp = new Date().toISOString();
    
    // Add to full postings array
    this.history.postings.push({
      propertyId,
      groupId,
      groupName,
      timestamp,
      success,
      day: this.history.currentDay,
    });

    // Update group stats
    if (!this.history.groupStats[groupId]) {
      this.history.groupStats[groupId] = { lastPosted: null, totalPosts: 0, successCount: 0, failedCount: 0, name: groupName, properties: [] };
    }
    const gs = this.history.groupStats[groupId];
    gs.lastPosted = timestamp;
    gs.totalPosts++;
    if (success) gs.successCount = (gs.successCount || 0) + 1;
    else gs.failedCount = (gs.failedCount || 0) + 1;
    if (groupName) gs.name = groupName;
    if (!gs.properties) gs.properties = [];
    if (propertyId && !gs.properties.includes(propertyId)) gs.properties.push(propertyId);

    // Update property stats
    if (!this.history.propertyStats[propertyId]) {
      this.history.propertyStats[propertyId] = { groups: [], lastPosted: null };
    }
    if (!this.history.propertyStats[propertyId].groups.includes(groupId)) {
      this.history.propertyStats[propertyId].groups.push(groupId);
    }
    this.history.propertyStats[propertyId].lastPosted = timestamp;

    // Update today's stats
    const today = this.history.todayStats;
    if (today) {
      today.postsCount++;
      if (success) today.successCount++;
      else today.failedCount++;
      if (!today.groupsPosted.includes(groupId)) today.groupsPosted.push(groupId);
      if (!today.propertiesPosted.includes(propertyId)) today.propertiesPosted.push(propertyId);
      if (!today.firstPostAt) today.firstPostAt = timestamp;
      today.lastPostAt = timestamp;
    }

    this.saveHistory();
    console.log(`📝 Recorded: Property ${propertyId} → Group "${groupName || groupId}" [${success ? '✅' : '❌'}]`);
  }

  /**
   * บันทึกว่าข้ามกลุ่ม (ซ้ำ/cooldown)
   */
  recordSkipped(propertyId, groupId, groupName = '', reason = 'duplicate') {
    this.checkDailyReset();
    const today = this.history.todayStats;
    if (today) {
      today.skippedDuplicate++;
    }
    this.saveHistory();
    console.log(`⏭️ Skipped: Property ${propertyId} → Group "${groupName || groupId}" (${reason})`);
  }

  /**
   * บันทึกเริ่ม automation run ใหม่
   */
  recordAutomationRun(propertyId, groupCount) {
    this.checkDailyReset();
    const today = this.history.todayStats;
    if (today) {
      today.automationRuns++;
    }
    this.saveHistory();
    console.log(`🚀 Automation Run #${today?.automationRuns} — ${groupCount} groups for property ${propertyId}`);
  }

  /**
   * ล้างข้อมูลทั้งหมด
   */
  resetAll() {
    this.history = {
      postings: [],
      groupStats: {},
      propertyStats: {},
      currentDay: null,
      todayStats: null,
      dailyArchive: {},
    };
    this.checkDailyReset();
    this.saveHistory();
    console.log('🗑️ PostingTracker: All data reset');
  }

  /**
   * บันทึก batch สำเร็จ
   */
  recordBatch(batchNum, groupCount, successCount) {
    this.checkDailyReset();
    const today = this.history.todayStats;
    if (today) {
      today.batches.push({
        batchNum,
        groupCount,
        successCount,
        timestamp: new Date().toISOString(),
      });
    }
    this.saveHistory();
  }

  // ============================================
  // DUPLICATE PREVENTION
  // ============================================

  /**
   * ตรวจสอบว่ากลุ่มนี้โพสต์ได้หรือยัง (ตาม cooldown)
   * cooldown คือ นับตาม daily cycle (reset 05:00) ไม่ใช่ 24 ชม.แบบเดิม
   */
  canPostToGroup(propertyId, groupId, cooldownHours = 24) {
    this.checkDailyReset();
    
    // Simple check: already posted this property to this group TODAY?
    const todayPostings = this.history.postings.filter(
      p => p.day === this.history.currentDay && p.propertyId === propertyId && p.groupId === groupId && p.success
    );

    if (todayPostings.length > 0) {
      return false; // Already posted today
    }

    // If cooldown is less than 24h, also check recent hours
    if (cooldownHours < 24) {
      const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
      const recentPostings = this.history.postings.filter(
        p => p.propertyId === propertyId && p.groupId === groupId && p.success && new Date(p.timestamp) > cutoff
      );
      return recentPostings.length === 0;
    }

    return true;
  }

  /**
   * กรองกลุ่มที่สามารถโพสต์ได้วันนี้
   */
  filterAvailableGroups(propertyId, groupIds, cooldownHours = 24) {
    return groupIds.filter(groupId => 
      this.canPostToGroup(propertyId, groupId, cooldownHours)
    );
  }

  /**
   * ดึงกลุ่มที่ยังไม่เคยโพสต์ property นี้เลย
   */
  getUnpostedGroups(propertyId, allGroupIds) {
    const propertyStats = this.history.propertyStats[propertyId];
    
    if (!propertyStats) {
      return allGroupIds;
    }

    return allGroupIds.filter(groupId => 
      !propertyStats.groups.includes(groupId)
    );
  }

  /**
   * จัดเรียงกลุ่มตาม priority
   */
  sortGroupsByLastPosted(groupIds) {
    return [...groupIds].sort((a, b) => {
      const statsA = this.history.groupStats[a];
      const statsB = this.history.groupStats[b];
      
      if (!statsA) return -1;
      if (!statsB) return 1;
      
      const timeA = new Date(statsA.lastPosted || 0);
      const timeB = new Date(statsB.lastPosted || 0);
      
      return timeA - timeB;
    });
  }

  /**
   * Smart pre-flight check — ก่อนเริ่ม automation
   * คืนค่า: กลุ่มที่โพสต์ได้ / กลุ่มที่ข้าม / limit เหลือเท่าไหร่
   */
  preflightCheck(propertyId, groupIds, userPackage = 'free') {
    this.checkDailyReset();
    const limit = PACKAGE_LIMITS[userPackage] || PACKAGE_LIMITS.free;
    const used = this.history.todayStats?.postsCount || 0;
    const remaining = Math.max(0, limit - used);

    // Filter out already-posted groups
    const available = this.filterAvailableGroups(propertyId, groupIds);
    const skipped = groupIds.filter(id => !available.includes(id));

    // Cap to remaining limit
    const canPost = available.slice(0, remaining);
    const overLimit = available.slice(remaining);

    return {
      totalRequested: groupIds.length,
      canPost,            // กลุ่มที่โพสต์ได้จริง
      skippedDuplicate: skipped,  // ข้ามเพราะโพสต์ไปแล้ววันนี้
      skippedOverLimit: overLimit, // ข้ามเพราะเกิน limit
      dailyLimit: limit,
      dailyUsed: used,
      dailyRemaining: remaining,
      canProceed: canPost.length > 0,
    };
  }

  // ============================================
  // HISTORY & STATS
  // ============================================

  getHistory() {
    return this.history;
  }

  getPropertyHistory(propertyId) {
    return {
      postings: this.history.postings.filter(p => p.propertyId === propertyId),
      stats: this.history.propertyStats[propertyId] || null,
    };
  }

  getGroupStats(groupId) {
    return this.history.groupStats[groupId] || null;
  }

  /**
   * ดึงประวัติย้อนหลัง N วัน
   */
  getDailyHistory(days = 7) {
    const result = [];
    const archive = this.history.dailyArchive || {};

    // Include today
    result.push({
      date: this.history.currentDay,
      ...(this.history.todayStats || {}),
      isToday: true,
    });

    // Include archived days
    const keys = Object.keys(archive).sort().reverse();
    for (const key of keys.slice(0, days - 1)) {
      result.push({
        date: key,
        ...archive[key],
        isToday: false,
      });
    }

    return result;
  }

  cleanupOldHistory(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.history.postings = this.history.postings.filter(p => 
      new Date(p.timestamp) > cutoffDate
    );

    this.saveHistory();
    console.log(`🧹 Cleaned up history older than ${daysToKeep} days`);
  }

  resetPropertyHistory(propertyId) {
    this.history.postings = this.history.postings.filter(p => 
      p.propertyId !== propertyId
    );
    delete this.history.propertyStats[propertyId];
    
    this.saveHistory();
    console.log(`🔄 Reset history for property ${propertyId}`);
  }

  /**
   * Shuffle array with deterministic seed
   */
  shuffleWithSeed(array, seed) {
    const shuffled = [...array];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      const j = hash % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  smartSelectGroups(propertyId, allGroupIds, maxGroups = 10, options = {}) {
    const {
      cooldownHours = 24,
      preferUnposted = true,
      rotateDaily = true,
    } = options;

    let availableGroups = this.filterAvailableGroups(propertyId, allGroupIds, cooldownHours);
    
    if (preferUnposted) {
      const unpostedGroups = this.getUnpostedGroups(propertyId, availableGroups);
      const postedGroups = availableGroups.filter(g => !unpostedGroups.includes(g));
      const sortedUnposted = this.sortGroupsByLastPosted(unpostedGroups);
      const sortedPosted = this.sortGroupsByLastPosted(postedGroups);
      availableGroups = [...sortedUnposted, ...sortedPosted];
    }

    if (rotateDaily) {
      const today = new Date().toDateString();
      const seed = propertyId + today;
      availableGroups = this.shuffleWithSeed(availableGroups, seed);
    }

    return availableGroups.slice(0, maxGroups);
  }
}
