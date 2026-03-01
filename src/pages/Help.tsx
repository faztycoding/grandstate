import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Building2,
  Users,
  Facebook,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Zap,
  Image,
  ShieldCheck,
  BarChart3,
  Clock,
  Lightbulb,
  Palette,
  Calendar,
  Lock,
  Scale,
  FileText,
  MessageSquare,
  TrendingUp,
  Target,
  ChevronRight,
  Cog,
  Wrench,
  Terminal,
  CircuitBoard,
  Gauge,
  ScanLine,
  Monitor,
  Activity,
  Share2,
  Home,
  Settings,
} from 'lucide-react';
import { GrandStateLogo } from '@/components/GrandStateLogo';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

/* ── Reusable Components ── */

function Rivet({ className }: { className?: string }) {
  return (
    <div className={cn(
      "absolute w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-600",
      "shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.8)]",
      className
    )} />
  );
}

function MachinePanel({ children, className, glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={cn(
      "relative rounded-xl border overflow-hidden",
      "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-[#0f172a] dark:to-slate-900",
      "border-[hsl(var(--accent)/0.2)] dark:border-[hsl(var(--accent)/0.15)]",
      "shadow-[inset_0_0_15px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]",
      glow && "shadow-[0_0_20px_hsl(var(--accent)/0.08)]",
      className
    )}>
      <Rivet className="top-2 left-2" />
      <Rivet className="top-2 right-2" />
      <Rivet className="bottom-2 left-2" />
      <Rivet className="bottom-2 right-2" />
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-accent', gear = false }: { icon: any; title: string; subtitle?: string; color?: string; gear?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4 sm:mb-5">
      <div className="relative">
        {gear ? (
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 border border-[hsl(var(--accent)/0.2)] flex items-center justify-center"
          >
            <Settings className={cn("w-5 h-5", color)} />
          </motion.div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 border border-[hsl(var(--accent)/0.2)] flex items-center justify-center">
            <Icon className={cn("w-5 h-5", color)} />
          </div>
        )}
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
      </div>
      <div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ChainDivider() {
  return (
    <div className="relative py-6 overflow-hidden">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-b border-dashed border-slate-300 dark:border-slate-700" />
      </div>
      <motion.div
        animate={{ x: [0, -160] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="relative flex gap-0 text-foreground/30 dark:text-foreground/60 whitespace-nowrap select-none"
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} className="text-lg tracking-tight">🔗</span>
        ))}
      </motion.div>
    </div>
  );
}

function AutomationMonitor({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  const isLeft = side === 'left';
  return (
    <div className={cn(
      "bg-card/80 backdrop-blur-sm border rounded-lg p-2.5 shadow-sm",
      isLeft
        ? "border-accent/30 shadow-[0_0_12px_hsl(var(--accent)/0.06)]"
        : "border-accent/30 shadow-[0_0_12px_hsl(var(--accent)/0.06)]",
      !isLeft && "text-right"
    )}>
      {children}
    </div>
  );
}

function TerminalLine({ prefix, children, color = 'text-emerald-500' }: { prefix: string; children: React.ReactNode; color?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-foreground/50 flex-shrink-0">[{prefix}]</span>
      <span className={color}>{children}</span>
    </div>
  );
}

export default function Help() {
  const { language } = useLanguage();
  const isEn = language === 'en';

  return (
    <DashboardLayout 
      title={isEn ? 'Help Center' : 'ศูนย์ช่วยเหลือ'} 
      subtitle={isEn ? 'Everything you need to get the most out of GrandState' : 'ทุกสิ่งที่คุณต้องรู้เพื่อใช้งาน GrandState อย่างเต็มประสิทธิภาพ'}
    >
      {/* Blueprint Grid Background Overlay */}
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 relative">
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.02] dark:opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--accent) / 0.5) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--accent) / 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />

        {/* Background spinning gear (decorative) */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none fixed -top-32 -right-32 z-0 text-foreground/[0.03]"
        >
          <Settings size={350} strokeWidth={0.5} />
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none fixed -bottom-40 -left-40 z-0 text-foreground/[0.03]"
        >
          <Settings size={400} strokeWidth={0.5} />
        </motion.div>

        {/* ═══ AUTOMATION MONITORS (Top Bar) ═══ */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <AutomationMonitor side="left">
            <div className="flex items-center gap-2 text-accent text-[11px] font-mono mb-0.5">
              <Monitor size={13} className="animate-pulse" />
              <span className="font-bold tracking-wider">AUTOMATION ENGINE</span>
            </div>
            <div className="text-[10px] text-foreground">ID: GS-MAIN-01 | STATUS: STANDBY</div>
          </AutomationMonitor>

          <AutomationMonitor side="right">
            <div className="flex items-center justify-end gap-2 text-accent text-[11px] font-mono mb-0.5">
              <span className="font-bold tracking-wider">SYSTEM LOAD</span>
              <Activity size={13} className="animate-bounce" />
            </div>
            <div className="text-[10px] text-foreground">OPTIMAL | LATENCY: 0.04ms</div>
          </AutomationMonitor>
        </div>

        {/* ═══ QUICK START — Initialization Sequence ═══ */}
        <MachinePanel glow>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Cog}
              title={isEn ? '01. Initialization Sequence' : '01. ลำดับการเริ่มต้นระบบ'}
              subtitle={isEn ? '4 steps to activate your posting engine' : '4 ขั้นตอน เปิดใช้งานเครื่องยนต์โพสต์อัตโนมัติ'}
              color="text-accent"
              gear
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { n: 1, icon: Home, title: isEn ? 'Add Property' : 'เพิ่มสินทรัพย์', desc: isEn ? 'LOAD ASSET DATA' : 'โหลดข้อมูลสินทรัพย์', detail: isEn ? 'Fill in details, upload photos, set price & location' : 'กรอกข้อมูล อัพรูป ตั้งราคา และที่ตั้ง', link: '/properties' },
                { n: 2, icon: Share2, title: isEn ? 'Add Groups' : 'เพิ่มกลุ่ม', desc: isEn ? 'TARGETING FB GROUPS' : 'กำหนดกลุ่มเป้าหมาย', detail: isEn ? 'Paste Facebook group URLs — add as many as you need' : 'วาง URL กลุ่ม Facebook — เพิ่มได้ไม่จำกัด', link: '/groups' },
                { n: 3, icon: Monitor, title: isEn ? 'Connect FB' : 'เชื่อมต่อ FB', desc: isEn ? 'ENCRYPT SESSION' : 'เข้ารหัส Session', detail: isEn ? 'Log in once — the system remembers your session' : 'Login ครั้งเดียว ระบบจำ session อัตโนมัติ', link: '/settings' },
                { n: 4, icon: Zap, title: isEn ? 'Launch Engine' : 'เริ่มโพสต์', desc: isEn ? 'LAUNCH ENGINE' : 'สตาร์ทเครื่องยนต์', detail: isEn ? 'Select property & groups, then let automation handle the rest' : 'เลือกสินทรัพย์ + กลุ่ม แล้วปล่อยระบบทำงาน', link: '/automation' },
              ].map((step, i) => (
                <Link key={step.n} to={step.link}>
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.02, backgroundColor: 'hsl(var(--accent) / 0.04)' }}
                    className="group relative p-4 rounded-lg border-t-2 border-accent border-x border-b border-x-border border-b-border transition-all h-full bg-white/50 dark:bg-slate-800/50 overflow-hidden"
                  >
                    {/* Corner gear decoration */}
                    <Settings className="absolute -right-2 -bottom-2 text-foreground/[0.03] group-hover:text-accent/10 transition-colors" size={50} />
                    <div className="text-[10px] text-accent mb-2 font-bold font-mono tracking-[0.15em]">STEP_{String(step.n).padStart(2, '0')}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <step.icon className="w-4 h-4 text-accent" />
                      <span className="text-sm font-bold">{step.title}</span>
                    </div>
                    <p className="text-[10px] text-foreground font-mono mb-1.5">{step.desc}</p>
                    <p className="text-xs text-foreground leading-relaxed">{step.detail}</p>
                    <ArrowRight className="w-3.5 h-3.5 text-foreground/20 group-hover:text-accent absolute top-4 right-4 transition-colors" />
                  </motion.div>
                </Link>
              ))}
            </div>
            {/* Connection chain between steps (desktop only) */}
            <div className="hidden lg:flex items-center justify-center gap-0 mt-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center">
                  <div className="w-16 lg:w-24 h-px bg-gradient-to-r from-accent/30 to-accent/10" />
                  <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                  <div className="w-16 lg:w-24 h-px bg-gradient-to-r from-accent/10 to-accent/30" />
                </div>
              ))}
            </div>
          </div>
        </MachinePanel>

        {/* ═══ CHAIN DIVIDER ═══ */}
        <ChainDivider />

        {/* ═══ OPERATION MODES ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Target}
              title={isEn ? '02. Operation Modes' : '02. โหมดปฏิบัติการ'}
              subtitle={isEn ? 'Choose the approach that fits your strategy' : 'เลือกโหมดที่ตอบโจทย์กลยุทธ์การตลาดของคุณ'}
              color="text-accent"
              gear
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Marketplace Module */}
              <div className="relative p-5 rounded-lg border-l-4 border-l-blue-500 border border-blue-300/20 dark:border-blue-500/15 bg-blue-50/30 dark:bg-blue-950/15 space-y-3 overflow-hidden">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute -right-3 -top-3 text-blue-500/[0.06]"
                >
                  <Settings size={60} />
                </motion.div>
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-mono text-[10px] mb-2">
                      <ScanLine className="w-3 h-3 mr-1" /> MARKETPLACE MODULE
                    </Badge>
                    <p className="text-sm font-bold">{isEn ? 'Automated Asset Distribution' : 'กระจายสินทรัพย์อัตโนมัติ'}</p>
                  </div>
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                  {isEn
                    ? 'Creates a listing on Facebook Marketplace with human-like behavior and shares to selected groups. Anti-detection system ensures maximum safety.'
                    : 'สร้าง Listing บน Facebook Marketplace จำลองพฤติกรรมมนุษย์ และแชร์ไปยังกลุ่มที่เลือก ระบบ Anti-detection ช่วยให้ปลอดภัยสูงสุด'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['#ANTI-DETECTION', '#SMART_RESIZE', '#AUTO_FILL'].map(t => (
                    <span key={t} className="px-2 py-0.5 bg-blue-500/8 border border-blue-500/20 text-[10px] text-foreground dark:text-blue-400 font-mono rounded">{t}</span>
                  ))}
                </div>
              </div>
              {/* Mass Group Deploy */}
              <div className="relative p-5 rounded-lg border-l-4 border-l-accent border border-accent/20 dark:border-accent/15 bg-[hsl(var(--accent)/0.03)] space-y-3 overflow-hidden">
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute -right-3 -top-3 text-accent/[0.06]"
                >
                  <Settings size={60} />
                </motion.div>
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-[hsl(var(--accent)/0.1)] text-accent font-mono text-[10px] mb-2">
                      <CircuitBoard className="w-3 h-3 mr-1" /> MASS GROUP DEPLOY
                    </Badge>
                    <p className="text-sm font-bold">{isEn ? 'Cluster Deployment System' : 'ระบบกระจายแบบคลัสเตอร์'}</p>
                  </div>
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                  {isEn
                    ? 'Distributes property data to target groups simultaneously with content rotation to prevent spam detection.'
                    : 'กระจายข้อมูลทรัพย์สินลงสู่กลุ่มเป้าหมายพร้อมกัน พร้อมระบบหมุนเวียน Content ป้องกันการตรวจจับ Spam'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['#MASS_BROADCAST', '#CAPTION_AI', '#BUY_SELL'].map(t => (
                    <span key={t} className="px-2 py-0.5 bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.2)] text-[10px] text-foreground font-mono rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MachinePanel>

        {/* ═══ CHAIN DIVIDER ═══ */}
        <ChainDivider />

        {/* ═══ FEATURES OVERVIEW ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Wrench}
              title={isEn ? '03. System Modules' : '03. โมดูลของระบบ'}
              subtitle={isEn ? 'Core capabilities of the engine' : 'ความสามารถหลักของเครื่องยนต์'}
              color="text-accent"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Sparkles, title: isEn ? 'AI Caption' : 'AI Caption', desc: isEn ? 'Generate unique, engaging captions powered by Claude AI — tailored for each post' : 'สร้างแคปชั่นที่ไม่ซ้ำและน่าสนใจด้วย Claude AI — ปรับให้เหมาะกับแต่ละโพสต์', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { icon: Image, title: isEn ? 'Smart Photo Upload' : 'อัพรูปอัจฉริยะ', desc: isEn ? 'Automatically uploads property photos with each post' : 'อัพโหลดรูปสินทรัพย์อัตโนมัติพร้อมทุกโพสต์', color: 'text-pink-400', bg: 'bg-pink-500/10' },
                { icon: ShieldCheck, title: isEn ? 'Health Check' : 'Health Check', desc: isEn ? 'Monitor account safety score — get recommendations to post safely' : 'ตรวจสอบคะแนนความปลอดภัย — รับคำแนะนำเพื่อโพสต์อย่างปลอดภัย', color: 'text-green-400', bg: 'bg-green-500/10' },
                { icon: BarChart3, title: isEn ? 'Analytics' : 'วิเคราะห์ผล', desc: isEn ? 'Track posting history, success rates, and group performance' : 'ติดตามประวัติโพสต์ อัตราสำเร็จ และประสิทธิภาพกลุ่ม', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { icon: Calendar, title: isEn ? 'Schedule Posts' : 'ตั้งเวลาโพสต์', desc: isEn ? 'Schedule posts for optimal times — the system runs automatically' : 'ตั้งเวลาโพสต์ล่วงหน้า — ระบบทำงานอัตโนมัติตามเวลาที่กำหนด', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { icon: Palette, title: isEn ? 'Customizable Theme' : 'ปรับธีมได้', desc: isEn ? 'Multiple color palettes with dark/light mode to match your style' : 'หลายโทนสีพร้อมโหมดมืด/สว่าง ปรับตามสไตล์คุณ', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 hover:border-[hsl(var(--accent)/0.3)] transition-colors"
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600", f.bg)}>
                    <f.icon className={cn("w-4.5 h-4.5", f.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </MachinePanel>

        {/* ═══ PRO TIPS ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Gauge}
              title={isEn ? '04. Performance Optimization' : '04. ปรับแต่งประสิทธิภาพ'}
              subtitle={isEn ? 'Tuning tips for maximum output' : 'เคล็ดลับเพื่อผลลัพธ์สูงสุด'}
              color="text-accent"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Clock, title: isEn ? 'Post at Peak Hours' : 'โพสต์ช่วงเวลาทอง', desc: isEn ? '7-9 AM and 6-9 PM typically get the highest reach and engagement' : '7-9 โมงเช้า และ 6-9 โมงเย็น เป็นช่วงที่ได้ reach และ engagement สูงสุด' },
                { icon: MessageSquare, title: isEn ? 'Great Captions Matter' : 'แคปชั่นดี = ยอดขาย', desc: isEn ? 'Include price, location & contact clearly. Use AI Caption for professional results.' : 'ใส่ราคา ที่ตั้ง ข้อมูลติดต่อชัดเจน ใช้ AI Caption ช่วยได้ผลมืออาชีพ' },
                { icon: Image, title: isEn ? 'Quality Photos First' : 'รูปคุณภาพมาก่อน', desc: isEn ? 'Use bright, high-resolution photos. The cover image is what buyers see first.' : 'ใช้รูปสว่าง ความละเอียดสูง รูปแรกคือสิ่งที่ผู้ซื้อเห็นก่อน' },
                { icon: TrendingUp, title: isEn ? 'Use Multiple Captions' : 'ใช้แคปชั่นหลายแบบ', desc: isEn ? 'Vary your captions across groups for better visibility and engagement' : 'ใช้แคปชั่นต่างกันในแต่ละกลุ่ม ช่วยเพิ่มการมองเห็นและ engagement' },
                { icon: ShieldCheck, title: isEn ? 'Monitor Health Score' : 'เช็คคะแนนสุขภาพ', desc: isEn ? 'Keep your Health Check score green for long-term account safety' : 'รักษาคะแนน Health Check ให้อยู่ในโซนเขียวเพื่อความปลอดภัยระยะยาว' },
                { icon: Calendar, title: isEn ? 'Schedule Ahead' : 'ตั้งเวลาล่วงหน้า', desc: isEn ? 'Use scheduling for consistent daily posting without manual effort' : 'ตั้งเวลาโพสต์ล่วงหน้าเพื่อความสม่ำเสมอโดยไม่ต้องกดเอง' },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200/30 dark:border-amber-700/20 bg-amber-50/30 dark:bg-amber-950/10">
                  <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-300/30 dark:border-amber-700/30 flex items-center justify-center flex-shrink-0">
                    <tip.icon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="text-xs text-foreground mt-0.5">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MachinePanel>

        {/* ═══ CHAIN DIVIDER ═══ */}
        <ChainDivider />

        {/* ═══ FAQ ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Terminal}
              title={isEn ? '05. Troubleshoot & FAQ' : '05. แก้ปัญหา & คำถามที่พบบ่อย'}
              color="text-emerald-400"
            />
            <Accordion type="single" collapsible className="w-full">
              {(isEn ? [
                { q: 'What is the difference between Marketplace and Group Post mode?', a: 'Marketplace mode creates a listing on Facebook Marketplace with auto-filled property details (price, location, photos, description) and shares it to your selected groups — reaching both Marketplace browsers and group members simultaneously. Group Post mode posts directly to each group individually with AI-generated unique captions per group, and fully supports buy/sell group forms with auto-filled fields. Both modes use anti-detection to simulate human behavior.' },
                { q: 'How many groups can I post to per day?', a: 'Rookie (Free): 10 posts/day, 10 groups, 10 properties. Top Agent: 300 posts/day, 300 groups, unlimited properties. Elite: 750 posts/day, 750 groups, unlimited properties. The system enforces these limits automatically. View the Pricing page for full details.' },
                { q: 'How does AI Caption work?', a: 'GrandState uses Claude AI (managed on our secure server) to automatically generate unique, professional Thai captions for each group post. Captions include property details, price, location, and relevant hashtags — no two captions are the same, helping avoid spam detection. No API key setup is needed from your side.' },
                { q: 'Is my Facebook account safe?', a: 'GrandState includes a 6-layer Anti-Detection system: randomized delays between posts, human-like mouse/scroll behavior, browser fingerprint masking, session isolation per user, cookie management, and viewport randomization. The Health Check module monitors your account safety score in real-time and recommends optimal posting frequency to keep your account safe.' },
                { q: 'What if something goes wrong during automation?', a: 'The system tracks progress for each group in real-time with status per task (success, failed, pending approval). If interrupted, all successfully posted groups retain their posts. You can resume or restart for remaining groups anytime. Scheduled posts and background jobs continue running on the server even if you close your browser.' },
                { q: 'Can I schedule posts for later?', a: 'Yes! (Top Agent & Elite packages) When starting automation, toggle "Schedule for later" and set a date & time. The server runs the job automatically at the scheduled time — your browser doesn\'t need to be open. View and manage all scheduled posts from the Automation sidebar.' },
                { q: 'Is my data secure?', a: 'Your property and group data is stored in Supabase (encrypted cloud database) linked to your authenticated account. Facebook sessions are stored in encrypted isolated browser profiles on the server — your Facebook password is never stored or transmitted. All API communication uses HTTPS with JWT authentication.' },
              ] : [
                { q: 'Marketplace กับ Group Post ต่างกันอย่างไร?', a: 'Marketplace สร้างประกาศบน Facebook Marketplace พร้อมกรอกข้อมูลอัตโนมัติ (ราคา ที่ตั้ง รูป รายละเอียด) แล้วแชร์ไปยังกลุ่มที่เลือก — เข้าถึงทั้งคนเข้าดู Marketplace และสมาชิกกลุ่มพร้อมกัน ส่วน Group Post โพสต์ตรงไปแต่ละกลุ่มพร้อมแคปชั่น AI ที่ไม่ซ้ำกัน รองรับกลุ่มซื้อขายกรอกฟอร์มอัตโนมัติ ทั้งสองโหมดใช้ระบบ Anti-Detection จำลองพฤติกรรมมนุษย์' },
                { q: 'โพสต์ได้วันละกี่กลุ่ม?', a: 'Rookie (ฟรี): 10 โพสต์/วัน, 10 กลุ่ม, 10 สินทรัพย์ | Top Agent: 300 โพสต์/วัน, 300 กลุ่ม, สินทรัพย์ไม่จำกัด | Elite: 750 โพสต์/วัน, 750 กลุ่ม, สินทรัพย์ไม่จำกัด ระบบจะจำกัดจำนวนอัตโนมัติตามแพ็คเกจ ดูรายละเอียดที่หน้าราคา' },
                { q: 'AI Caption ทำงานอย่างไร?', a: 'ระบบใช้ Claude AI (จัดการบนเซิร์ฟเวอร์ของเราอย่างปลอดภัย) สร้างแคปชั่นภาษาไทยมืออาชีพที่ไม่ซ้ำกันสำหรับแต่ละกลุ่ม ใส่รายละเอียดสินทรัพย์ ราคา ที่ตั้ง และ hashtag ที่เกี่ยวข้อง — ช่วยหลีกเลี่ยงการตรวจจับ spam ไม่ต้องตั้งค่า API Key เอง ระบบจัดการให้อัตโนมัติ' },
                { q: 'บัญชี Facebook ปลอดภัยไหม?', a: 'ระบบมี Anti-Detection 6 ชั้น: สุ่มหน่วงเวลาระหว่างโพสต์, จำลองพฤติกรรมเมาส์/เลื่อนหน้าจอเหมือนมนุษย์, ปลอม Browser Fingerprint, แยก Session ต่อผู้ใช้, จัดการ Cookie, และสุ่มขนาดหน้าจอ ระบบ Health Check ตรวจสอบคะแนนความปลอดภัยแบบ real-time และแนะนำความถี่ในการโพสต์ที่เหมาะสม' },
                { q: 'ถ้าระบบขัดข้องระหว่างทำงานล่ะ?', a: 'ระบบติดตามความคืบหน้าแต่ละกลุ่มแบบ real-time พร้อมสถานะต่อ task (สำเร็จ, ล้มเหลว, รออนุมัติ) กลุ่มที่โพสต์ไปแล้วจะยังอยู่ คุณสามารถเริ่มใหม่สำหรับกลุ่มที่เหลือได้ทุกเมื่อ โพสต์ตั้งเวลาและ background jobs ทำงานต่อบนเซิร์ฟเวอร์แม้ปิดเบราว์เซอร์แล้ว' },
                { q: 'ตั้งเวลาโพสต์ล่วงหน้าได้ไหม?', a: 'ได้! (แพ็คเกจ Top Agent & Elite) ตอนเริ่ม automation เปิด "ตั้งเวลาโพสต์" แล้วเลือกวันและเวลา เซิร์ฟเวอร์จะรันงานอัตโนมัติเมื่อถึงเวลา — ไม่ต้องเปิดเบราว์เซอร์ค้างไว้ ดูและจัดการโพสต์ตั้งเวลาได้จากแถบด้านข้างหน้า Automation' },
                { q: 'ข้อมูลของฉันปลอดภัยไหม?', a: 'ข้อมูลสินทรัพย์และกลุ่มเก็บใน Supabase (ฐานข้อมูลคลาวด์เข้ารหัส) ผูกกับบัญชีที่ยืนยันตัวตนแล้ว Session Facebook เก็บในโปรไฟล์เบราว์เซอร์เข้ารหัสแยกต่อผู้ใช้บนเซิร์ฟเวอร์ — ไม่เก็บหรือส่งรหัสผ่าน Facebook ทุกการสื่อสาร API ใช้ HTTPS พร้อม JWT authentication' },
              ]).map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-slate-200/50 dark:border-slate-700/50">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline hover:text-accent transition-colors">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-accent/60">#{String(i + 1).padStart(2, '0')}</span>
                      {faq.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-foreground leading-relaxed pl-8">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </MachinePanel>

        {/* ═══ TERMS & PRIVACY ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Scale}
              title={isEn ? 'Legal & Compliance' : 'ข้อกำหนดและความเป็นส่วนตัว'}
              color="text-muted-foreground"
            />
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="disclaimer" className="border-slate-200/50 dark:border-slate-700/50">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-400" />
                    {isEn ? 'Disclaimer' : 'ข้อจำกัดความรับผิดชอบ'}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-foreground leading-relaxed">
                  {isEn
                    ? 'GrandState is a posting assistance tool. The developer is not responsible if your Facebook account is restricted, suspended, or banned. The app provides Health Check monitoring and recommendations, but the user assumes all responsibility for posting behavior and account safety.'
                    : 'GrandState เป็นเครื่องมือช่วยโพสต์ ผู้พัฒนาไม่รับผิดชอบหากบัญชี Facebook ถูกจำกัด ระงับ หรือแบน แอปมีระบบ Health Check คอยตรวจสอบและแนะนำ แต่ผู้ใช้รับผิดชอบพฤติกรรมการโพสต์และความปลอดภัยของบัญชีตนเอง'}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="terms" className="border-slate-200/50 dark:border-slate-700/50">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    {isEn ? 'Terms of Use' : 'ข้อกำหนดการใช้งาน'}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="text-xs text-foreground space-y-1.5 leading-relaxed">
                    <li className="flex items-start gap-2"><span className="text-foreground/60 font-mono text-[10px] mt-0.5">01</span> {isEn ? 'Provided "as is" without warranty.' : 'ให้บริการ "ตามสภาพ" โดยไม่มีการรับประกัน'}</li>
                    <li className="flex items-start gap-2"><span className="text-foreground/60 font-mono text-[10px] mt-0.5">02</span> {isEn ? 'Users must comply with Facebook\'s Terms of Service.' : 'ผู้ใช้ต้องปฏิบัติตามข้อกำหนดของ Facebook'}</li>
                    <li className="flex items-start gap-2"><span className="text-foreground/60 font-mono text-[10px] mt-0.5">03</span> {isEn ? 'Users are responsible for content and posting frequency.' : 'ผู้ใช้รับผิดชอบเนื้อหาและความถี่ในการโพสต์'}</li>
                    <li className="flex items-start gap-2"><span className="text-foreground/60 font-mono text-[10px] mt-0.5">04</span> {isEn ? 'Do not use for spam, scam, or illegal activity.' : 'ห้ามใช้เพื่อสแปม หลอกลวง หรือกิจกรรมผิดกฎหมาย'}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="privacy" className="border-slate-200/50 dark:border-slate-700/50">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-400" />
                    {isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">01</span> {isEn ? 'Property & group data stored in Supabase encrypted cloud database, linked to your authenticated account.' : 'ข้อมูลสินทรัพย์และกลุ่มจัดเก็บใน Supabase (ฐานข้อมูลคลาวด์เข้ารหัส) ผูกกับบัญชีที่ยืนยันตัวตน'}</li>
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">02</span> {isEn ? 'Facebook sessions stored in encrypted, isolated browser profiles on the server — your password is never stored or transmitted.' : 'Session Facebook เก็บในโปรไฟล์เบราว์เซอร์เข้ารหัสแยกต่อผู้ใช้บนเซิร์ฟเวอร์ — ไม่เก็บหรือส่งรหัสผ่าน'}</li>
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">03</span> {isEn ? 'AI caption generation runs on our secure server — no third-party API keys needed from users.' : 'ระบบสร้างแคปชั่น AI ทำงานบนเซิร์ฟเวอร์ของเรา — ผู้ใช้ไม่ต้องใส่ API Key ใดๆ'}</li>
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">04</span> {isEn ? 'All API communication uses HTTPS with JWT authentication. Delete your data anytime from Settings.' : 'ทุกการสื่อสาร API ใช้ HTTPS พร้อม JWT authentication ลบข้อมูลได้ตลอดเวลาจากหน้าตั้งค่า'}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </MachinePanel>

        {/* ═══ TERMINAL LOGS ═══ */}
        <MachinePanel>
          <div className="p-4 font-mono text-[11px] leading-[1.8] bg-[hsl(217,71%,6%)] dark:bg-black/60 rounded-lg border border-slate-800 space-y-0">
            <TerminalLine prefix="SYS" color="text-emerald-500/80">Grand$tate Help Terminal v1.0 initialized...</TerminalLine>
            <TerminalLine prefix="CFG" color="text-accent/70">Timeout: 30m per session</TerminalLine>
            <TerminalLine prefix="SEC" color="text-blue-400/70">Anti-detection modules loaded — stealth active</TerminalLine>
            <TerminalLine prefix="NET" color="text-emerald-500/70">SSE connection stable — heartbeat OK</TerminalLine>
            <div className="flex gap-2">
              <span className="text-muted-foreground/50 flex-shrink-0">[SYS]</span>
              <span className="text-emerald-500/60 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Waiting for user input...
              </span>
            </div>
          </div>
        </MachinePanel>

        {/* ═══ QUICK LINKS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: isEn ? 'Automation' : 'Automation', link: '/automation', icon: Zap, color: 'text-accent' },
            { label: isEn ? 'Properties' : 'สินทรัพย์', link: '/properties', icon: Building2, color: 'text-blue-500' },
            { label: isEn ? 'Analytics' : 'วิเคราะห์', link: '/analytics', icon: BarChart3, color: 'text-violet-500' },
            { label: isEn ? 'Settings' : 'ตั้งค่า', link: '/settings', icon: Cog, color: 'text-muted-foreground' },
          ].map((item) => (
            <Link key={item.link} to={item.link}>
              <Button variant="outline" className="w-full justify-start gap-2 h-11 border-slate-200 dark:border-slate-700 hover:border-[hsl(var(--accent)/0.4)] hover:bg-[hsl(var(--accent)/0.04)] transition-all font-mono text-xs">
                <item.icon className={cn("w-4 h-4", item.color)} />
                {item.label}
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
              </Button>
            </Link>
          ))}
        </div>

        {/* ═══ VERSION ═══ */}
        <div className="text-center py-4 flex flex-col items-center gap-1.5">
          <GrandStateLogo className="w-7 h-7" />
          <p className="text-xs font-bold font-mono tracking-wider gradient-text">
            GRAND$TATE ENGINE
          </p>
          <p className="text-[9px] text-muted-foreground/60 font-mono tracking-[0.2em]">OPERATIONAL COMMAND CENTER v1.0</p>
          <p className="text-[8px] text-muted-foreground/40 font-mono">© 2026 GRAND$TATE CORE ENGINE</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
