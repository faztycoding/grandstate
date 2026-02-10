import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar, RefreshCw, Loader2, Clock, Trash2, XCircle, CheckCircle2, Play,
  Building2, Users, MapPin, BedDouble, Bath, Maximize2, Tag, Eye, Sparkles, ExternalLink,
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

import { apiFetch } from '@/lib/config';

const STATUS_CONFIG: Record<string, { color: string; gradient: string; icon: any; label: string; labelEn: string }> = {
  pending: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', gradient: 'from-amber-500 to-orange-500', icon: Clock, label: 'รอดำเนินการ', labelEn: 'Pending' },
  running: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', gradient: 'from-blue-500 to-indigo-500', icon: Play, label: 'กำลังทำงาน', labelEn: 'Running' },
  completed: { color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', gradient: 'from-green-500 to-emerald-500', icon: CheckCircle2, label: 'เสร็จสิ้น', labelEn: 'Done' },
  failed: { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', gradient: 'from-red-500 to-rose-500', icon: XCircle, label: 'ล้มเหลว', labelEn: 'Failed' },
  cancelled: { color: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400', gradient: 'from-gray-400 to-gray-500', icon: Trash2, label: 'ยกเลิก', labelEn: 'Cancelled' },
};

function formatPrice(price: number | string | undefined) {
  if (!price) return null;
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

export function ScheduledPostsCard() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/schedules');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) setSchedules(json.schedules || []);
    } catch (err) {
      console.warn('ScheduledPostsCard fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, []);

  const handleCancel = async (id: string) => {
    try { await apiFetch(`/api/schedules/${id}/cancel`, { method: 'POST' }); } catch {}
    setSelectedSchedule(null);
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    try { await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' }); } catch {}
    setSelectedSchedule(null);
    fetchSchedules();
  };

  const hasSchedules = schedules.length > 0;

  return (
    <>
      {/* Sidebar Card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              {isEn ? 'Scheduled Posts' : 'โพสต์ที่ตั้งเวลาไว้'}
              {schedules.filter(s => s.status === 'pending').length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  {schedules.filter(s => s.status === 'pending').length}
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchSchedules} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-6 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : !hasSchedules ? (
            <div className="py-4 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{isEn ? 'No scheduled posts yet' : 'ยังไม่มีโพสต์ที่ตั้งเวลาไว้'}</p>
              <p className="text-[10px] mt-0.5">{isEn ? 'Use the schedule option when starting automation' : 'ตั้งเวลาได้ตอนยืนยันเริ่ม Automation'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                const scheduledDate = new Date(s.scheduledAt);
                const now = new Date();
                const locale = isEn ? 'en-US' : 'th-TH';
                const timeStr = scheduledDate.toLocaleString(locale, {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                });
                const diffMs = scheduledDate.getTime() - now.getTime();
                const diffMin = Math.round(diffMs / 60000);
                const timeUntil = diffMin > 60
                  ? isEn ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${Math.floor(diffMin / 60)} ชม. ${diffMin % 60} นาที`
                  : diffMin > 0
                  ? isEn ? `${diffMin}m` : `${diffMin} นาที`
                  : '';
                const prop = s.property || {};
                const groups = s.groups || [];

                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:ring-2 hover:ring-blue-400/30 transition-all ${
                      s.status === 'pending' ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30' :
                      s.status === 'running' ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/30' :
                      'bg-card border-border'
                    }`}
                    onClick={() => setSelectedSchedule(s)}
                  >
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{prop.title || prop.name || 'Unknown'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{timeStr}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">👥 {groups.length}</Badge>
                        {s.status === 'pending' && timeUntil && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">({isEn ? `in ${timeUntil}` : `อีก ${timeUntil}`})</span>
                        )}
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog — popup center screen */}
      <Dialog open={!!selectedSchedule} onOpenChange={(open) => { if (!open) setSelectedSchedule(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-0">
          {selectedSchedule && (() => {
            const s = selectedSchedule;
            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const scheduledDate = new Date(s.scheduledAt);
            const now = new Date();
            const locale = isEn ? 'en-US' : 'th-TH';
            const fullDateStr = scheduledDate.toLocaleString(locale, {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            });
            const diffMs = scheduledDate.getTime() - now.getTime();
            const diffMin = Math.round(diffMs / 60000);
            const timeUntil = diffMin > 60
              ? isEn ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${Math.floor(diffMin / 60)} ชม. ${diffMin % 60} นาที`
              : diffMin > 0
              ? isEn ? `${diffMin} min` : `${diffMin} นาที`
              : isEn ? 'overdue' : 'เลยเวลาแล้ว';
            const prop = s.property || {};
            const groups = s.groups || [];
            const priceStr = formatPrice(prop.price);

            return (
              <>
                {/* Header Banner */}
                <div className={`bg-gradient-to-r ${cfg.gradient} p-5 pb-4`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                      <StatusIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogHeader className="p-0 space-y-0">
                        <DialogTitle className="text-white text-base font-bold truncate">
                          {prop.title || prop.name || 'Scheduled Post'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-1.5 py-0">
                          {isEn ? cfg.labelEn : cfg.label}
                        </Badge>
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-1.5 py-0">
                          {s.mode === 'marketplace' ? '🏪 Marketplace' : `👥 ${groups.length} ${isEn ? 'groups' : 'กลุ่ม'}`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Schedule Time */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{fullDateStr}{!isEn ? ' น.' : ''}</p>
                      {s.status === 'pending' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                          {isEn ? `⏳ Starts in ${timeUntil}` : `⏳ อีก ${timeUntil}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Property Photos */}
                  {prop.images && prop.images.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        📷 {isEn ? 'Photos' : 'รูปภาพ'}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {prop.images.slice(0, 3).map((img: string, idx: number) => (
                          <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted">
                            <img
                              src={img}
                              alt={`${prop.title || 'Property'} ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {idx === 0 && (
                              <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                                {isEn ? 'Cover' : 'ปก'}
                              </span>
                            )}
                            {idx === 2 && prop.images.length > 3 && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">+{prop.images.length - 3}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Property Details */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {isEn ? 'Property Details' : 'รายละเอียดสินทรัพย์'}
                    </p>
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-sm font-bold">{prop.title || prop.name || '-'}</p>
                      {(prop.propertyType || prop.listingType) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {prop.propertyType && <Badge variant="secondary" className="text-xs">{prop.propertyType}</Badge>}
                          {prop.listingType && <Badge variant="secondary" className="text-xs">{prop.listingType}</Badge>}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {prop.location && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            <span className="truncate">{prop.location}</span>
                          </div>
                        )}
                        {priceStr && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Tag className="w-3.5 h-3.5 text-green-500" />
                            <span className="font-bold text-green-600">฿{priceStr}</span>
                          </div>
                        )}
                        {prop.bedrooms && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BedDouble className="w-3.5 h-3.5" />
                            <span>{prop.bedrooms} {isEn ? 'bed' : 'นอน'}</span>
                          </div>
                        )}
                        {prop.bathrooms && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Bath className="w-3.5 h-3.5" />
                            <span>{prop.bathrooms} {isEn ? 'bath' : 'น้ำ'}</span>
                          </div>
                        )}
                        {prop.area && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{prop.area} {isEn ? 'sqm' : 'ตร.ม.'}</span>
                          </div>
                        )}
                        {prop.landArea && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Land:' : 'ที่ดิน:'} {prop.landArea}</span>
                          </div>
                        )}
                      </div>
                      {prop.googleMapsLink && (
                        <a href={prop.googleMapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <ExternalLink className="w-3 h-3" />Google Maps
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Groups */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {isEn ? `Target Groups (${groups.length})` : `กลุ่มเป้าหมาย (${groups.length})`}
                    </p>
                    <div className="rounded-xl border bg-card divide-y max-h-48 overflow-y-auto">
                      {groups.map((g: any, gi: number) => (
                        <div key={g.id || gi} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                          <span className="text-xs text-muted-foreground w-5 text-right font-mono">{gi + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{g.name || g.groupName || g.id}</p>
                          </div>
                          {g.memberCount && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{g.memberCount}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Caption AI Note */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30">
                    <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        {isEn ? 'AI Caption Generation' : 'สร้างแคปชั่นอัตโนมัติ'}
                      </p>
                      <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                        {isEn
                          ? 'Claude AI will generate unique, engaging captions for each group at posting time.'
                          : 'Claude AI จะสร้างแคปชั่นที่ไม่ซ้ำกันสำหรับแต่ละกลุ่มอัตโนมัติตอนถึงเวลาโพสต์'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {s.status === 'pending' && (
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleCancel(s.id)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {isEn ? 'Cancel Schedule' : 'ยกเลิกการตั้งเวลา'}
                      </Button>
                    )}
                    {(s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled') && (
                      <Button
                        variant="outline"
                        className="flex-1 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {isEn ? 'Delete' : 'ลบ'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedSchedule(null)}
                    >
                      {isEn ? 'Close' : 'ปิด'}
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
