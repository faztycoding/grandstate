import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Send,
  X,
  AlertTriangle,
  Bug,
  Lightbulb,
  CreditCard,
  Facebook,
  Zap,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';

interface SupportTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: 'general', label: 'ทั่วไป', labelEn: 'General', icon: HelpCircle, color: 'text-muted-foreground' },
  { value: 'bug', label: 'แจ้งบัค / ข้อผิดพลาด', labelEn: 'Bug Report', icon: Bug, color: 'text-red-500' },
  { value: 'feature', label: 'ขอฟีเจอร์ใหม่', labelEn: 'Feature Request', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'billing', label: 'การชำระเงิน / แพ็กเกจ', labelEn: 'Billing / Package', icon: CreditCard, color: 'text-emerald-500' },
  { value: 'facebook', label: 'Facebook เชื่อมต่อ', labelEn: 'Facebook Connection', icon: Facebook, color: 'text-[#1877F2]' },
  { value: 'automation', label: 'ระบบโพสต์อัตโนมัติ', labelEn: 'Automation', icon: Zap, color: 'text-purple-500' },
];

export function SupportTicketDialog({ open, onOpenChange }: SupportTicketDialogProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketDate] = useState(new Date());

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error(isEn ? 'Please fill in all fields' : 'กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(isEn ? 'Please login first' : 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }

      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        user_email: user.email || '',
        user_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        subject: subject.trim(),
        description: description.trim(),
        category,
      });

      if (error) throw error;

      // Show success animation
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onOpenChange(false);
        setSubject('');
        setDescription('');
        setCategory('general');
        toast.success(isEn ? 'Ticket submitted successfully!' : 'ส่งเรื่องแจ้งปัญหาสำเร็จ!');
      }, 3000);
    } catch (err: any) {
      console.error('Support ticket error:', err);
      toast.error(err.message || (isEn ? 'Failed to submit ticket' : 'ส่งเรื่องไม่สำเร็จ'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSubject('');
    setDescription('');
    setCategory('general');
    onOpenChange(false);
  };

  const selectedCat = CATEGORIES.find(c => c.value === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            /* ═══ Envelope Send Animation ═══ */
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 min-h-[320px] flex flex-col items-center justify-center overflow-hidden"
            >
              {/* HUD grid background */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
                  backgroundSize: '30px 30px'
                }} />
              </div>

              {/* Scan lines */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-cyan-500/5"
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />

              {/* Glowing circles */}
              <motion.div
                className="absolute w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Envelope animation */}
              <motion.div
                initial={{ y: 0, scale: 1 }}
                animate={{ y: [-10, -80], scale: [1, 0.6], opacity: [1, 0] }}
                transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
                  <Mail className="w-12 h-12 text-white" />
                </div>
              </motion.div>

              {/* Success text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="relative z-10 text-center mt-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1, type: 'spring', stiffness: 300 }}
                  className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-3"
                >
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </motion.div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {isEn ? 'Ticket Sent!' : 'ส่งเรื่องสำเร็จ!'}
                </h3>
                <p className="text-sm text-cyan-300/70">
                  {isEn
                    ? 'We will fix it as fast as possible once received.'
                    : 'เราจะรีบดำเนินการแก้ไขให้เร็วที่สุดเมื่อได้รับเรื่อง'
                  }
                </p>
              </motion.div>

              {/* Corner HUD elements */}
              <div className="absolute top-3 left-3 text-[9px] font-mono text-cyan-500/40">
                SYS://TICKET_SENT
              </div>
              <div className="absolute bottom-3 right-3 text-[9px] font-mono text-cyan-500/40">
                {ticketDate.toISOString()}
              </div>
            </motion.div>
          ) : (
            /* ═══ Ticket Form ═══ */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden"
            >
              {/* HUD grid background */}
              <div className="absolute inset-0 opacity-[0.05]">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)',
                  backgroundSize: '30px 30px'
                }} />
              </div>

              {/* Top accent bar */}
              <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

              <div className="relative z-10 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {isEn ? 'Report an Issue' : 'แจ้งปัญหา'}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {isEn ? 'We\'ll resolve it ASAP' : 'เราจะรีบแก้ไขให้ไวที่สุดเมื่อได้รับเรื่อง'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    className="w-8 h-8 text-muted-foreground hover:text-white hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Date display */}
                <div className="flex items-center gap-2 mb-5 p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-mono text-cyan-300/80">
                    {isEn ? 'Date Received: ' : 'วันที่รับเรื่อง: '}
                    {ticketDate.toLocaleDateString(isEn ? 'en-US' : 'th-TH', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Category selector */}
                <div className="mb-4">
                  <Label className="text-xs font-semibold text-foreground mb-2 block">
                    {isEn ? 'Category' : 'หมวดหมู่'}
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon;
                      const isSelected = category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          onClick={() => setCategory(cat.value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-center",
                            isSelected
                              ? "border-cyan-500/50 bg-cyan-500/10 shadow-sm shadow-cyan-500/10"
                              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                          )}
                        >
                          <CatIcon className={cn("w-4 h-4", isSelected ? cat.color : "text-muted-foreground")} />
                          <span className={cn("text-[10px] font-medium leading-tight", isSelected ? "text-white" : "text-muted-foreground")}>
                            {isEn ? cat.labelEn : cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div className="mb-4">
                  <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                    {isEn ? 'Subject' : 'หัวข้อ'}
                  </Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isEn ? 'Brief description of the issue...' : 'สรุปปัญหาสั้นๆ...'}
                    className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-500/50 focus:ring-cyan-500/20"
                    maxLength={100}
                  />
                </div>

                {/* Description */}
                <div className="mb-5">
                  <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                    {isEn ? 'Details' : 'รายละเอียด'}
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isEn ? 'Describe the issue in detail...' : 'อธิบายรายละเอียดปัญหา...'}
                    className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-500/50 focus:ring-cyan-500/20 min-h-[100px] resize-none"
                    maxLength={2000}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">{description.length}/2000</p>
                </div>

                {/* Promise banner */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 mb-5">
                  <AlertTriangle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-300">
                      {isEn ? 'We\'ll get back to you ASAP' : 'เราจะรีบแก้ไขให้ไวที่สุด'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {isEn
                        ? 'Our team will review and respond to your issue as soon as it\'s received.'
                        : 'ทีมงานจะตรวจสอบและดำเนินการแก้ไขให้ทันทีที่ได้รับเรื่อง'
                      }
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleCancel}
                    className="flex-1 h-11 text-muted-foreground hover:text-white hover:bg-white/10 rounded-xl border border-white/10"
                  >
                    {isEn ? 'Cancel' : 'ยกเลิก'}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !subject.trim() || !description.trim()}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Send className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {isEn ? 'Submit Report' : 'ส่งแจ้งปัญหา'}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Bottom HUD decorations */}
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              <div className="flex items-center justify-between px-4 py-2 bg-black/30">
                <span className="text-[9px] font-mono text-cyan-500/30">GRANDSTATE://SUPPORT</span>
                <span className="text-[9px] font-mono text-cyan-500/30">v1.0</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
