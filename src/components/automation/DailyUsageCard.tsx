import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/config';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Zap,
  TrendingUp,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  CheckCircle2,
  XCircle,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyStats {
  date: string;
  postsCount: number;
  successCount: number;
  failedCount: number;
  skippedDuplicate: number;
  limit: number;
  remaining: number;
  usagePercent: number;
  automationRuns: number;
  nextResetAt: string;
  nextResetIn: string;
  batches: { batchNum: number; groupCount: number; successCount: number; timestamp: string }[];
}

interface DailyUsageCardProps {
  userPackage?: string;
  className?: string;
}

export function DailyUsageCard({ userPackage = 'free', className }: DailyUsageCardProps) {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/posting/today?userPackage=${userPackage}`);
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch {
      // Backend not running
    } finally {
      setLoading(false);
    }
  }, [userPackage]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="py-4 px-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="w-4 h-4 animate-pulse" />
            กำลังโหลดสถิติวันนี้...
          </div>
        </CardContent>
      </Card>
    );
  }

  const isOverHalf = stats.usagePercent >= 50;
  const isNearLimit = stats.usagePercent >= 80;
  const isAtLimit = stats.remaining === 0;

  return (
    <Card className={cn(
      "transition-all",
      isAtLimit && "border-red-300 bg-red-50/50 dark:bg-red-950/10",
      isNearLimit && !isAtLimit && "border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10",
      !isNearLimit && "border-border",
      className
    )}>
      <CardContent className="py-3 px-4 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">โพสต์วันนี้</span>
            <Badge
              variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}
              className="text-[10px] h-5 px-1.5"
            >
              {stats.postsCount}/{stats.limit}
            </Badge>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Progress bar */}
        <div>
          <Progress
            value={stats.usagePercent}
            className={cn(
              "h-2",
              isAtLimit && "[&>div]:bg-red-500",
              isNearLimit && !isAtLimit && "[&>div]:bg-yellow-500",
            )}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              เหลือ {stats.remaining} โพสต์
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              รีเซ็ต {stats.nextResetIn}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 text-xs">
          {stats.successCount > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats.successCount} สำเร็จ
            </div>
          )}
          {stats.failedCount > 0 && (
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="w-3.5 h-3.5" />
              {stats.failedCount} ล้มเหลว
            </div>
          )}
          {stats.skippedDuplicate > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <SkipForward className="w-3.5 h-3.5" />
              {stats.skippedDuplicate} ข้าม
            </div>
          )}
          {stats.automationRuns > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <Zap className="w-3.5 h-3.5" />
              รอบที่ {stats.automationRuns}
            </div>
          )}
        </div>

        {/* Expanded details */}
        {expanded && stats.batches && stats.batches.length > 0 && (
          <div className="border-t pt-2 mt-1 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Batch History วันนี้
            </p>
            {stats.batches.map((batch, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] bg-muted/30 rounded px-2 py-1">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-accent" />
                  Batch #{batch.batchNum}
                </span>
                <span>
                  {batch.successCount}/{batch.groupCount} กลุ่ม
                </span>
                <span className="text-muted-foreground">
                  {new Date(batch.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* At limit warning */}
        {isAtLimit && (
          <div className="bg-red-100 dark:bg-red-900/30 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>ถึงลิมิตวันนี้แล้ว! รีเซ็ตใน {stats.nextResetIn}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
