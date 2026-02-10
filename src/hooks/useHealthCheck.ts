import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/lib/config';

// ============================================================
// Facebook Ban Risk Health Check System v2
// ============================================================
// Now fetches REAL data from backend postingTracker instead of
// relying on separate localStorage history.
//
// Scoring: 0 = safe, 100 = critical (ban risk)
// 8 factors → weighted average → overall risk level
// ============================================================

export interface RiskFactor {
  id: string;
  score: number;           // 0-100
  weight: number;          // 0-1
  weightedScore: number;   // score * weight
  level: 'safe' | 'moderate' | 'high' | 'critical';
}

export interface HealthCheckResult {
  overallScore: number;    // 0-100
  overallLevel: 'safe' | 'moderate' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  stats: {
    postsToday: number;
    postsThisHour: number;
    postsThisWeek: number;
    avgDelayMinutes: number;
    uniqueCaptions: number;
    totalCaptions: number;
    longestSessionMinutes: number;
    accountAgeDays: number;
  };
}

// ============================================================
// THRESHOLDS — Calibrated from real-world FB anti-spam patterns
// ============================================================

const THRESHOLDS = {
  VELOCITY: { SAFE: 3, MODERATE: 6, HIGH: 10, CRITICAL: 15 },
  DAILY: { SAFE: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  MIN_DELAY: { SAFE: 5, MODERATE: 2, HIGH: 1, CRITICAL: 0.3 },
  DIVERSITY: { SAFE: 0.7, MODERATE: 0.4, HIGH: 0.2, CRITICAL: 0.05 },
  SESSION: { SAFE: 30, MODERATE: 60, HIGH: 120, CRITICAL: 240 },
  ACCELERATION: { SAFE: 1.5, MODERATE: 3.0, HIGH: 5.0, CRITICAL: 10.0 },
  WARMUP_DAYS: 7,
  WARMUP_DAILY_SAFE: [3, 5, 8, 12, 15, 20, 25],
};

const WEIGHTS = {
  velocity: 0.22,
  dailyVolume: 0.20,
  intervalEntropy: 0.13,
  captionDiversity: 0.15,
  minDelay: 0.12,
  acceleration: 0.08,
  sessionDuration: 0.05,
  warmup: 0.05,
};

// ============================================================
// SCORING HELPERS
// ============================================================

function thresholdScore(value: number, safe: number, moderate: number, high: number, critical: number): number {
  if (value <= 0) return 0;
  if (value <= safe) return Math.round((value / Math.max(safe, 0.01)) * 20);
  if (value <= moderate) return 20 + Math.round(((value - safe) / Math.max(moderate - safe, 0.01)) * 30);
  if (value <= high) return 50 + Math.round(((value - moderate) / Math.max(high - moderate, 0.01)) * 25);
  if (value <= critical) return 75 + Math.round(((value - high) / Math.max(critical - high, 0.01)) * 20);
  return Math.min(100, 95 + Math.round(((value - critical) / Math.max(critical, 1)) * 5));
}

function inverseThresholdScore(value: number, safe: number, moderate: number, high: number, critical: number): number {
  if (value >= safe) return Math.max(0, 10 - Math.round(((value - safe) / Math.max(safe, 0.01)) * 10));
  if (value >= moderate) return 20 + Math.round(((safe - value) / Math.max(safe - moderate, 0.01)) * 30);
  if (value >= high) return 50 + Math.round(((moderate - value) / Math.max(moderate - high, 0.01)) * 25);
  if (value >= critical) return 75 + Math.round(((high - value) / Math.max(high - critical, 0.01)) * 20);
  return Math.min(100, 95);
}

function scoreToLevel(score: number): 'safe' | 'moderate' | 'high' | 'critical' {
  if (score <= 25) return 'safe';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'critical';
}

// ============================================================
// MAIN CALCULATION — from backend data
// ============================================================

interface BackendData {
  postsToday: number;
  postsThisHour: number;
  postsThisWeek: number;
  postsLastWeek: number;
  avgDelayMinutes: number;
  minDelayMinutes: number;
  intervalCV: number;
  diversityRatio: number;
  uniqueProperties: number;
  sessionMinutes: number;
  accountAgeDays: number;
  successRate: number;
  automationRuns: number;
  successToday: number;
  failedToday: number;
}

function calculateFromBackend(d: BackendData): HealthCheckResult {
  const hasData = d.postsToday > 0;

  // Factor 1: Velocity (posts/hour)
  const velocityScore = thresholdScore(d.postsThisHour, THRESHOLDS.VELOCITY.SAFE, THRESHOLDS.VELOCITY.MODERATE, THRESHOLDS.VELOCITY.HIGH, THRESHOLDS.VELOCITY.CRITICAL);

  // Factor 2: Daily volume
  const dailyScore = thresholdScore(d.postsToday, THRESHOLDS.DAILY.SAFE, THRESHOLDS.DAILY.MODERATE, THRESHOLDS.DAILY.HIGH, THRESHOLDS.DAILY.CRITICAL);

  // Factor 3: Interval entropy (CV from backend)
  let entropyScore = 0;
  if (d.intervalCV >= 0 && d.postsToday >= 3) {
    const cv = d.intervalCV;
    if (cv >= 0.5) entropyScore = 5;
    else if (cv >= 0.3) entropyScore = 15;
    else if (cv >= 0.15) entropyScore = 40;
    else if (cv >= 0.05) entropyScore = 70;
    else entropyScore = 90;
  }

  // Factor 4: Content diversity (property diversity ratio from backend)
  let captionScore = 0;
  if (hasData) {
    captionScore = inverseThresholdScore(d.diversityRatio, THRESHOLDS.DIVERSITY.SAFE, THRESHOLDS.DIVERSITY.MODERATE, THRESHOLDS.DIVERSITY.HIGH, THRESHOLDS.DIVERSITY.CRITICAL);
  }

  // Factor 5: Minimum delay between posts
  let delayScore = 0;
  if (d.minDelayMinutes >= 0 && d.postsToday >= 2) {
    delayScore = inverseThresholdScore(d.minDelayMinutes, THRESHOLDS.MIN_DELAY.SAFE, THRESHOLDS.MIN_DELAY.MODERATE, THRESHOLDS.MIN_DELAY.HIGH, THRESHOLDS.MIN_DELAY.CRITICAL);
  }

  // Factor 6: Weekly acceleration
  let accelerationScore = 0;
  if (d.postsThisWeek > 0) {
    let acceleration: number;
    if (d.postsLastWeek > 0) {
      acceleration = d.postsThisWeek / d.postsLastWeek;
    } else {
      // No last week data — only flag if this week is truly high
      acceleration = d.postsThisWeek > 15 ? 2.5 : 1.0;
    }
    accelerationScore = thresholdScore(acceleration, THRESHOLDS.ACCELERATION.SAFE, THRESHOLDS.ACCELERATION.MODERATE, THRESHOLDS.ACCELERATION.HIGH, THRESHOLDS.ACCELERATION.CRITICAL);
  }

  // Factor 7: Session duration
  const sessionScore = d.sessionMinutes > 0
    ? thresholdScore(d.sessionMinutes, THRESHOLDS.SESSION.SAFE, THRESHOLDS.SESSION.MODERATE, THRESHOLDS.SESSION.HIGH, THRESHOLDS.SESSION.CRITICAL)
    : 0;

  // Factor 8: Account warmup compliance
  let warmupScore = 0;
  if (d.accountAgeDays < THRESHOLDS.WARMUP_DAYS && hasData) {
    const safeDailyMax = THRESHOLDS.WARMUP_DAILY_SAFE[Math.min(d.accountAgeDays, THRESHOLDS.WARMUP_DAILY_SAFE.length - 1)];
    const ratio = d.postsToday / Math.max(safeDailyMax, 1);
    warmupScore = ratio <= 1 ? 0 : Math.min(100, Math.round((ratio - 1) * 50));
  }

  // Compile factors
  const makeFactor = (id: string, score: number, weight: number): RiskFactor => ({
    id, score, weight,
    weightedScore: score * weight,
    level: scoreToLevel(score),
  });

  const factors: RiskFactor[] = [
    makeFactor('velocity', velocityScore, WEIGHTS.velocity),
    makeFactor('dailyVolume', dailyScore, WEIGHTS.dailyVolume),
    makeFactor('intervalEntropy', entropyScore, WEIGHTS.intervalEntropy),
    makeFactor('captionDiversity', captionScore, WEIGHTS.captionDiversity),
    makeFactor('minDelay', delayScore, WEIGHTS.minDelay),
    makeFactor('acceleration', accelerationScore, WEIGHTS.acceleration),
    makeFactor('sessionDuration', sessionScore, WEIGHTS.sessionDuration),
    makeFactor('warmup', warmupScore, WEIGHTS.warmup),
  ];

  const overallScore = Math.round(factors.reduce((sum, f) => sum + f.weightedScore, 0));
  const overallLevel = scoreToLevel(overallScore);

  // Recommendations
  const recommendations: string[] = [];
  if (velocityScore > 40) recommendations.push('slowDown');
  if (dailyScore > 40) recommendations.push('reduceDailyVolume');
  if (entropyScore > 40) recommendations.push('randomizeIntervals');
  if (captionScore > 40) recommendations.push('diversifyCaptions');
  if (delayScore > 40) recommendations.push('increaseDelay');
  if (accelerationScore > 40) recommendations.push('gradualIncrease');
  if (sessionScore > 40) recommendations.push('shorterSessions');
  if (warmupScore > 40) recommendations.push('warmupAccount');
  if (recommendations.length === 0) recommendations.push('allGood');

  return {
    overallScore,
    overallLevel,
    factors,
    recommendations,
    stats: {
      postsToday: d.postsToday,
      postsThisHour: d.postsThisHour,
      postsThisWeek: d.postsThisWeek,
      avgDelayMinutes: d.avgDelayMinutes >= 0 ? d.avgDelayMinutes : 999,
      uniqueCaptions: d.uniqueProperties,
      totalCaptions: d.postsToday,
      longestSessionMinutes: d.sessionMinutes,
      accountAgeDays: d.accountAgeDays,
    },
  };
}

// ============================================================
// DEFAULT RESULT — shown while loading or when backend is down
// ============================================================

const DEFAULT_RESULT: HealthCheckResult = {
  overallScore: 0,
  overallLevel: 'safe',
  factors: Object.entries(WEIGHTS).map(([id, weight]) => ({
    id, score: 0, weight, weightedScore: 0, level: 'safe' as const,
  })),
  recommendations: ['allGood'],
  stats: {
    postsToday: 0, postsThisHour: 0, postsThisWeek: 0,
    avgDelayMinutes: 999, uniqueCaptions: 0, totalCaptions: 0,
    longestSessionMinutes: 0, accountAgeDays: 0,
  },
};

// ============================================================
// MAIN HOOK
// ============================================================

export function useHealthCheck() {
  const [result, setResult] = useState<HealthCheckResult>(DEFAULT_RESULT);

  const fetchHealthCheck = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/health-check`);
      if (!resp.ok) throw new Error('Health check API failed');
      const json = await resp.json();
      if (json.success && json.data) {
        setResult(calculateFromBackend(json.data));
      }
    } catch {
      // Backend not reachable — keep current result
    }
  }, []);

  // Fetch on mount + poll every 15 seconds
  useEffect(() => {
    fetchHealthCheck();
    const interval = setInterval(fetchHealthCheck, 15000);
    return () => clearInterval(interval);
  }, [fetchHealthCheck]);

  // Clear history via backend reset
  const clearHistory = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/analytics/reset`, { method: 'POST' });
      setResult(DEFAULT_RESULT);
    } catch {
      // ignore
    }
  }, []);

  return {
    result,
    clearHistory,
    refetch: fetchHealthCheck,
  };
}
