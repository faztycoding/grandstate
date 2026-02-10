import { useState, useCallback } from 'react';
import { API_BASE } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  Zap,
  AlertCircle,
  Trash2,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

interface GroupFetchResult {
  url: string;
  name: string;
  memberCount: number;
  postsToday: number;
  postsLastMonth: number;
  status: 'pending' | 'fetching' | 'success' | 'failed' | 'duplicate';
  error?: string;
}

interface BulkAddGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingGroupUrls: string[];
  onAddGroups: (groups: { name: string; url: string; memberCount: number; postsToday?: number; postsLastMonth?: number }[]) => void;
}

export function BulkAddGroupDialog({
  open,
  onOpenChange,
  existingGroupUrls,
  onAddGroups,
}: BulkAddGroupDialogProps) {
  const { t } = useLanguage();

  // Single mode state
  const [singleName, setSingleName] = useState('');
  const [singleUrl, setSingleUrl] = useState('');
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);

  // Bulk mode state
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [bulkUrls, setBulkUrls] = useState('');
  const [results, setResults] = useState<GroupFetchResult[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  const extractGroupUrl = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Match facebook.com/groups/... pattern
    const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:m\.)?facebook\.com\/groups\/([^\s/?#]+)/i);
    if (match) {
      return `https://www.facebook.com/groups/${match[1]}`;
    }

    // If it looks like just a group ID/slug
    if (/^[\w.-]+$/.test(trimmed) && trimmed.length > 3) {
      return `https://www.facebook.com/groups/${trimmed}`;
    }

    return null;
  };

  const parseUrls = (text: string): string[] => {
    const lines = text
      .split(/[\n,;]+/)
      .map(l => l.trim())
      .filter(Boolean);

    const urls: string[] = [];
    for (const line of lines) {
      const url = extractGroupUrl(line);
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  };

  const fetchGroupInfo = async (url: string): Promise<{ name: string; memberCount: number; postsToday: number; postsLastMonth: number } | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/groups/fetch-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.success && data.groupInfo) {
        return {
          name: data.groupInfo.name || '',
          memberCount: data.groupInfo.memberCount || 0,
          postsToday: data.groupInfo.postsToday || 0,
          postsLastMonth: data.groupInfo.postsLastMonth || 0,
        };
      }
    } catch (err) {
      console.error('Fetch group info error:', err);
    }
    return null;
  };

  // Single add with fetch
  const handleSingleAdd = async () => {
    if (!singleUrl.trim()) {
      toast.error(t.automation.fillGroupUrl);
      return;
    }

    const url = extractGroupUrl(singleUrl);
    if (!url) {
      toast.error('URL ไม่ถูกต้อง กรุณาใส่ลิงค์กลุ่ม Facebook');
      return;
    }

    // Check duplicate
    if (existingGroupUrls.some(u => u.includes(url.split('/groups/')[1]))) {
      toast.error('กลุ่มนี้มีอยู่แล้ว');
      return;
    }

    setIsFetchingSingle(true);
    const info = await fetchGroupInfo(url);
    setIsFetchingSingle(false);

    const name = singleName.trim() || info?.name || url.split('/groups/')[1] || 'Unknown';
    const memberCount = info?.memberCount || 0;
    const postsToday = info?.postsToday || 0;
    const postsLastMonth = info?.postsLastMonth || 0;

    onAddGroups([{ name, url, memberCount, postsToday, postsLastMonth }]);
    toast.success(`เพิ่มกลุ่ม "${name}" แล้ว`);
    setSingleName('');
    setSingleUrl('');
    onOpenChange(false);
  };

  // Bulk fetch all URLs
  const handleBulkFetch = async () => {
    const urls = parseUrls(bulkUrls);
    if (urls.length === 0) {
      toast.error('ไม่พบ URL กลุ่ม Facebook ที่ถูกต้อง');
      return;
    }

    // Initialize results
    const initialResults: GroupFetchResult[] = urls.map(url => {
      const isDuplicate = existingGroupUrls.some(u => u.includes(url.split('/groups/')[1]));
      return {
        url,
        name: '',
        memberCount: 0,
        postsToday: 0,
        postsLastMonth: 0,
        status: isDuplicate ? 'duplicate' : 'pending',
        error: isDuplicate ? 'มีอยู่แล้ว' : undefined,
      };
    });

    setResults(initialResults);
    setIsFetching(true);
    setFetchProgress({ current: 0, total: urls.length });

    const pendingResults = initialResults.filter(r => r.status === 'pending');

    for (let i = 0; i < pendingResults.length; i++) {
      const result = pendingResults[i];
      const idx = initialResults.findIndex(r => r.url === result.url);

      // Update status to fetching
      setResults(prev => prev.map((r, j) => j === idx ? { ...r, status: 'fetching' } : r));
      setFetchProgress({ current: i + 1, total: pendingResults.length });

      const info = await fetchGroupInfo(result.url);

      if (info && info.name) {
        setResults(prev => prev.map((r, j) =>
          j === idx ? { ...r, name: info.name, memberCount: info.memberCount, postsToday: info.postsToday, postsLastMonth: info.postsLastMonth, status: 'success' } : r
        ));
      } else {
        // Even if fetch failed, still allow adding with URL-based name
        const slug = result.url.split('/groups/')[1] || 'unknown';
        setResults(prev => prev.map((r, j) =>
          j === idx ? { ...r, name: slug, memberCount: 0, postsToday: 0, postsLastMonth: 0, status: 'failed', error: 'ดึงข้อมูลไม่ได้ (ต้องเปิด Backend + Login FB)' } : r
        ));
      }

      // Small delay between requests
      if (i < pendingResults.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsFetching(false);
  };

  // Add all successful groups
  const handleBulkAdd = () => {
    const successGroups = results
      .filter(r => r.status === 'success' || r.status === 'failed') // Add even failed (with slug name)
      .filter(r => r.status !== 'duplicate')
      .map(r => ({
        name: r.name,
        url: r.url,
        memberCount: r.memberCount,
        postsToday: r.postsToday,
        postsLastMonth: r.postsLastMonth,
      }));

    if (successGroups.length === 0) {
      toast.error('ไม่มีกลุ่มที่จะเพิ่ม');
      return;
    }

    onAddGroups(successGroups);
    toast.success(`เพิ่ม ${successGroups.length} กลุ่มสำเร็จ!`);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setBulkUrls('');
    setResults([]);
    setIsFetching(false);
    setFetchProgress({ current: 0, total: 0 });
    setSingleName('');
    setSingleUrl('');
  };

  const removeResult = (url: string) => {
    setResults(prev => prev.filter(r => r.url !== url));
  };

  const parsedCount = parseUrls(bulkUrls).length;
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const duplicateCount = results.filter(r => r.status === 'duplicate').length;
  const progressPercent = fetchProgress.total > 0 ? Math.round((fetchProgress.current / fetchProgress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isFetching) onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            {t.automation.addGroup}
          </DialogTitle>
          <DialogDescription>
            วาง URL กลุ่ม Facebook — ทีละกลุ่มหรือหลายกลุ่มพร้อมกัน
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            className={cn(
              "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
              mode === 'single' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setMode('single'); setResults([]); }}
            disabled={isFetching}
          >
            <Link2 className="w-3.5 h-3.5 inline mr-1.5" />
            เพิ่มทีละกลุ่ม
          </button>
          <button
            className={cn(
              "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
              mode === 'bulk' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setMode('bulk')}
            disabled={isFetching}
          >
            <Zap className="w-3.5 h-3.5 inline mr-1.5" />
            เพิ่มหลายกลุ่ม
          </button>
        </div>

        {/* SINGLE MODE */}
        {mode === 'single' && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.automation.groupName}</Label>
              <Input
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="เช่น ซื้อขายบ้าน กรุงเทพ (ไม่ใส่ก็ได้ — ดึงอัตโนมัติ)"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.automation.groupUrl}</Label>
              <div className="flex gap-2">
                <Input
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  placeholder="https://facebook.com/groups/..."
                  className="flex-1"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                กด "ดึงข้อมูล" เพื่อดึงชื่อกลุ่มและจำนวนสมาชิกอัตโนมัติ (ต้องเปิด Backend)
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                {t.common.cancel}
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onClick={handleSingleAdd}
                disabled={isFetchingSingle}
              >
                {isFetchingSingle ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {isFetchingSingle ? 'กำลังดึงข้อมูล...' : t.automation.addGroupBtn}
              </Button>
            </div>
          </div>
        )}

        {/* BULK MODE */}
        {mode === 'bulk' && (
          <div className="space-y-3 pt-2 flex-1 min-h-0 flex flex-col">
            {/* Input Area — show when no results yet */}
            {results.length === 0 && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    วาง URL กลุ่ม (บรรทัดละ 1 กลุ่ม)
                  </Label>
                  <Textarea
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    placeholder={`https://facebook.com/groups/group1\nhttps://facebook.com/groups/group2\nhttps://facebook.com/groups/group3\n...\n\nหรือวางหลาย URL คั่นด้วย Enter, comma, หรือ semicolon`}
                    rows={6}
                    className="text-xs font-mono resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      รองรับ URL แบบ facebook.com/groups/xxx หรือ m.facebook.com/groups/xxx
                    </p>
                    {parsedCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        พบ {parsedCount} กลุ่ม
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button
                    variant="accent"
                    className="flex-1"
                    onClick={handleBulkFetch}
                    disabled={parsedCount === 0}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    ดึงข้อมูล {parsedCount} กลุ่ม
                  </Button>
                </div>
              </>
            )}

            {/* Fetching Progress + Results */}
            {results.length > 0 && (
              <>
                {/* Progress Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isFetching && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                      {!isFetching && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      <span className="text-sm font-semibold">
                        {isFetching
                          ? `กำลังดึงข้อมูล ${fetchProgress.current}/${fetchProgress.total}...`
                          : `ดึงข้อมูลเสร็จแล้ว`
                        }
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {successCount > 0 && (
                        <Badge className="bg-green-100 text-green-700 text-[10px] h-5">✅ {successCount}</Badge>
                      )}
                      {failedCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-[10px] h-5">❌ {failedCount}</Badge>
                      )}
                      {duplicateCount > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-700 text-[10px] h-5">ซ้ำ {duplicateCount}</Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={isFetching ? progressPercent : 100} className="h-2" />
                </div>

                {/* Results List */}
                <ScrollArea className="flex-1 min-h-0 max-h-[250px]">
                  <div className="space-y-1.5 pr-2">
                    <AnimatePresence>
                      {results.map((result, idx) => (
                        <motion.div
                          key={result.url}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
                            result.status === 'success' && "bg-green-50 border-green-200 dark:bg-green-950/20",
                            result.status === 'fetching' && "bg-blue-50 border-blue-200 dark:bg-blue-950/20",
                            result.status === 'failed' && "bg-red-50 border-red-200 dark:bg-red-950/20",
                            result.status === 'duplicate' && "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20",
                            result.status === 'pending' && "bg-muted/30 border-border",
                          )}
                        >
                          {result.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                          {result.status === 'fetching' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
                          {result.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                          {result.status === 'duplicate' && <XCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />}
                          {result.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}

                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {result.name || result.url.split('/groups/')[1] || 'Loading...'}
                            </p>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {result.memberCount > 0 && (
                                <span>{result.memberCount.toLocaleString()} สมาชิก</span>
                              )}
                              {result.error && (
                                <span className="text-red-500">{result.error}</span>
                              )}
                            </div>
                          </div>

                          {!isFetching && result.status !== 'duplicate' && (
                            <button
                              className="p-1 rounded hover:bg-red-100 transition-colors"
                              onClick={() => removeResult(result.url)}
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>

                {/* Action Buttons */}
                {!isFetching && (
                  <div className="flex gap-3 pt-1">
                    <Button variant="outline" className="flex-1" onClick={handleReset}>
                      เริ่มใหม่
                    </Button>
                    <Button
                      variant="accent"
                      className="flex-1"
                      onClick={handleBulkAdd}
                      disabled={successCount + failedCount === 0}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      เพิ่ม {successCount + failedCount - duplicateCount} กลุ่ม
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
