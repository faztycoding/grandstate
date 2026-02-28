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
} from 'lucide-react';
import { GrandStateLogo } from '@/components/GrandStateLogo';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
      "border-cyan-500/20 dark:border-cyan-500/15",
      "shadow-[inset_0_0_15px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]",
      glow && "shadow-[0_0_20px_rgba(0,255,255,0.05)] dark:shadow-[0_0_20px_rgba(0,255,255,0.08)]",
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

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-cyan-500' }: { icon: any; title: string; subtitle?: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 sm:mb-5">
      <div className="relative">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 border border-cyan-500/20 flex items-center justify-center">
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
      </div>
      <div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
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
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,255,255,0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,255,255,0.4) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />

        {/* ═══ QUICK START — 4 Steps ═══ */}
        <MachinePanel glow>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Cog}
              title={isEn ? 'System Boot Sequence' : 'ลำดับการเริ่มต้นระบบ'}
              subtitle={isEn ? '4 steps to activate your posting engine' : '4 ขั้นตอน เปิดใช้งานเครื่องยนต์โพสต์อัตโนมัติ'}
              color="text-cyan-400"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { n: 1, icon: Building2, title: isEn ? 'Add Property' : 'เพิ่มสินทรัพย์', desc: isEn ? 'Fill in details, upload photos, set price & location' : 'กรอกข้อมูล อัพรูป ตั้งราคา และที่ตั้ง', link: '/properties', color: 'from-blue-500 to-cyan-500' },
                { n: 2, icon: Users, title: isEn ? 'Add Groups' : 'เพิ่มกลุ่ม', desc: isEn ? 'Paste Facebook group URLs — add as many as you need' : 'วาง URL กลุ่ม Facebook — เพิ่มได้ไม่จำกัด', link: '/groups', color: 'from-green-500 to-emerald-500' },
                { n: 3, icon: Facebook, title: isEn ? 'Connect Facebook' : 'เชื่อมต่อ Facebook', desc: isEn ? 'Log in once — the system remembers your session' : 'Login ครั้งเดียว ระบบจำ session อัตโนมัติ', link: '/settings', color: 'from-[#1877F2] to-blue-600' },
                { n: 4, icon: Zap, title: isEn ? 'Start Posting' : 'เริ่มโพสต์', desc: isEn ? 'Select property & groups, then let automation handle the rest' : 'เลือกสินทรัพย์ + กลุ่ม แล้วปล่อยระบบทำงาน', link: '/automation', color: 'from-amber-500 to-orange-500' },
              ].map((step, i) => (
                <Link key={step.n} to={step.link}>
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="group relative p-4 rounded-lg border transition-all h-full bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-cyan-400/40 hover:shadow-[0_0_12px_rgba(0,255,255,0.08)]"
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md`}>
                        <step.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 tracking-wider">STEP_{step.n}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-cyan-500 absolute top-4 right-4 transition-colors" />
                  </motion.div>
                </Link>
              ))}
            </div>
            {/* Connection lines between steps (desktop only) */}
            <div className="hidden lg:flex items-center justify-center gap-0 mt-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center">
                  <div className="w-16 lg:w-24 h-px bg-gradient-to-r from-cyan-500/30 to-cyan-500/10" />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />
                  <div className="w-16 lg:w-24 h-px bg-gradient-to-r from-cyan-500/10 to-cyan-500/30" />
                </div>
              ))}
            </div>
          </div>
        </MachinePanel>

        {/* ═══ POSTING MODES ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Target}
              title={isEn ? 'Operation Modes' : 'โหมดปฏิบัติการ'}
              subtitle={isEn ? 'Choose the approach that fits your strategy' : 'เลือกโหมดที่ตอบโจทย์กลยุทธ์การตลาดของคุณ'}
              color="text-amber-400"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Marketplace */}
              <div className="relative p-5 rounded-lg border border-blue-300/30 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-mono text-[10px]">
                  <ScanLine className="w-3 h-3 mr-1" /> MARKETPLACE
                </Badge>
                <p className="text-sm font-bold">{isEn ? 'Marketplace Mode' : 'โหมด Marketplace'}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'Creates a listing on Facebook Marketplace and automatically shares to selected groups. Ideal for maximizing exposure.'
                    : 'สร้างประกาศบน Facebook Marketplace และแชร์ไปยังกลุ่มที่เลือกอัตโนมัติ เหมาะกับการเข้าถึงทั้งคนเข้าดู Marketplace และสมาชิกในกลุ่ม'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(isEn ? ['Auto listing', 'Group sharing', 'Photo gallery'] : ['สร้างประกาศอัตโนมัติ', 'แชร์ไปกลุ่ม', 'แกลเลอรี่รูป']).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/30">{t}</Badge>
                  ))}
                </div>
              </div>
              {/* Group Post */}
              <div className="relative p-5 rounded-lg border border-green-300/30 dark:border-green-500/20 bg-green-50/40 dark:bg-green-950/20 space-y-3">
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 font-mono text-[10px]">
                  <CircuitBoard className="w-3 h-3 mr-1" /> GROUP_POST
                </Badge>
                <p className="text-sm font-bold">{isEn ? 'Group Post Mode' : 'โหมด Group Post'}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'Posts directly to each Facebook group with full automation — including buy/sell groups with form auto-fill.'
                    : 'โพสต์ตรงไปยังแต่ละกลุ่มพร้อม automation เต็มรูปแบบ — รองรับกลุ่มซื้อขาย กรอกฟอร์มอัตโนมัติ (ประเภท, ราคา, ที่ตั้ง)'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(isEn ? ['Direct post', 'Buy/sell forms', 'Custom caption'] : ['โพสต์ตรง', 'ฟอร์มซื้อขาย', 'Caption กำหนดเอง']).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-mono bg-green-50 dark:bg-green-900/30 border-green-200/50 dark:border-green-700/30">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MachinePanel>

        {/* ═══ FEATURES OVERVIEW ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Wrench}
              title={isEn ? 'System Modules' : 'โมดูลของระบบ'}
              subtitle={isEn ? 'Core capabilities of the engine' : 'ความสามารถหลักของเครื่องยนต์'}
              color="text-violet-400"
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
                  className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 hover:border-cyan-400/30 transition-colors"
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600", f.bg)}>
                    <f.icon className={cn("w-4.5 h-4.5", f.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </MachinePanel>

        {/* ═══ PRO TIPS ═══ */}
        <MachinePanel className="border-amber-500/20 dark:border-amber-500/15">
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Gauge}
              title={isEn ? 'Performance Optimization' : 'ปรับแต่งประสิทธิภาพ'}
              subtitle={isEn ? 'Tuning tips for maximum output' : 'เคล็ดลับเพื่อผลลัพธ์สูงสุด'}
              color="text-amber-400"
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
                    <p className="text-xs text-muted-foreground mt-0.5">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MachinePanel>

        {/* ═══ FAQ ═══ */}
        <MachinePanel>
          <div className="p-4 sm:p-6">
            <SectionHeader
              icon={Terminal}
              title={isEn ? 'Troubleshoot & FAQ' : 'แก้ปัญหา & คำถามที่พบบ่อย'}
              color="text-emerald-400"
            />
            <Accordion type="single" collapsible className="w-full">
              {(isEn ? [
                { q: 'What is the difference between Marketplace and Group Post mode?', a: 'Marketplace mode creates a listing on Facebook Marketplace and shares it to your selected groups — great for reaching both Marketplace browsers and group members. Group Post mode posts directly to each group individually, with full support for buy/sell group forms.' },
                { q: 'How many groups can I post to per day?', a: 'It depends on your package. Higher tiers allow more daily posts. Check the Pricing page for details on each package.' },
                { q: 'What is the Claude API Key used for?', a: 'The Claude API Key enables AI-powered caption generation. It creates unique, professional captions for your property posts. Without it, you can still write captions manually. Get your key at console.anthropic.com.' },
                { q: 'Is my Facebook account safe?', a: 'GrandState includes a Health Check system that monitors your posting behavior and provides safety recommendations. We recommend following the suggested posting limits and maintaining a healthy score.' },
                { q: 'What if something goes wrong during automation?', a: 'The system tracks progress for each group in real-time. If interrupted, successfully posted groups keep their posts. You can restart for remaining groups anytime.' },
                { q: 'Can I schedule posts for later?', a: 'Yes! When starting automation, you can toggle "Schedule for later" and pick a date & time. The system will automatically run at the scheduled time.' },
                { q: 'Is my data private?', a: 'All data is stored locally on your device. Your Facebook session is managed locally, and your password is never stored by the app. Claude API keys are sent only to Anthropic\'s API directly.' },
              ] : [
                { q: 'Marketplace กับ Group Post ต่างกันอย่างไร?', a: 'Marketplace สร้างประกาศบน Facebook Marketplace แล้วแชร์ไปกลุ่มที่เลือก — เข้าถึงทั้งคนเข้าดู Marketplace และสมาชิกกลุ่ม ส่วน Group Post โพสต์ตรงไปแต่ละกลุ่ม รองรับกลุ่มซื้อขายกรอกฟอร์มอัตโนมัติ' },
                { q: 'โพสต์ได้วันละกี่กลุ่ม?', a: 'ขึ้นอยู่กับแพ็คเกจของคุณ แพ็คเกจสูงขึ้นโพสต์ได้มากขึ้น ดูรายละเอียดแต่ละแพ็คเกจได้ที่หน้าราคา' },
                { q: 'Claude API Key ใช้ทำอะไร?', a: 'ใช้สำหรับสร้างแคปชั่นอัตโนมัติด้วย AI สร้างข้อความมืออาชีพที่ไม่ซ้ำกันสำหรับแต่ละโพสต์ ไม่มีก็เขียนแคปชั่นเองได้ รับ key ที่ console.anthropic.com' },
                { q: 'บัญชี Facebook ปลอดภัยไหม?', a: 'ระบบมี Health Check คอยตรวจสอบพฤติกรรมการโพสต์และแนะนำการใช้งานที่ปลอดภัย แนะนำให้ทำตามจำนวนโพสต์ที่แนะนำและรักษาคะแนนให้อยู่ในเกณฑ์ดี' },
                { q: 'ถ้าระบบขัดข้องระหว่างทำงานล่ะ?', a: 'ระบบติดตามความคืบหน้าแต่ละกลุ่มแบบ real-time กลุ่มที่โพสต์ไปแล้วจะยังอยู่ คุณสามารถเริ่มใหม่สำหรับกลุ่มที่เหลือได้ทุกเมื่อ' },
                { q: 'ตั้งเวลาโพสต์ล่วงหน้าได้ไหม?', a: 'ได้! ตอนเริ่ม automation ให้เปิด "ตั้งเวลาโพสต์" แล้วเลือกวันและเวลา ระบบจะทำงานอัตโนมัติเมื่อถึงเวลาที่กำหนด' },
                { q: 'ข้อมูลของฉันปลอดภัยไหม?', a: 'ข้อมูลทั้งหมดเก็บในเครื่องของคุณเท่านั้น Session Facebook จัดการภายในเครื่อง แอปไม่เก็บรหัสผ่าน Claude API Key ส่งตรงไปยัง Anthropic เท่านั้น' },
              ]).map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-slate-200/50 dark:border-slate-700/50">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-cyan-500/60 dark:text-cyan-500/40">#{String(i + 1).padStart(2, '0')}</span>
                      {faq.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pl-8">
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
              color="text-slate-400"
            />
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="disclaimer" className="border-slate-200/50 dark:border-slate-700/50">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-400" />
                    {isEn ? 'Disclaimer' : 'ข้อจำกัดความรับผิดชอบ'}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
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
                  <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <li className="flex items-start gap-2"><span className="text-cyan-500/60 font-mono text-[10px] mt-0.5">01</span> {isEn ? 'Provided "as is" without warranty.' : 'ให้บริการ "ตามสภาพ" โดยไม่มีการรับประกัน'}</li>
                    <li className="flex items-start gap-2"><span className="text-cyan-500/60 font-mono text-[10px] mt-0.5">02</span> {isEn ? 'Users must comply with Facebook\'s Terms of Service.' : 'ผู้ใช้ต้องปฏิบัติตามข้อกำหนดของ Facebook'}</li>
                    <li className="flex items-start gap-2"><span className="text-cyan-500/60 font-mono text-[10px] mt-0.5">03</span> {isEn ? 'Users are responsible for content and posting frequency.' : 'ผู้ใช้รับผิดชอบเนื้อหาและความถี่ในการโพสต์'}</li>
                    <li className="flex items-start gap-2"><span className="text-cyan-500/60 font-mono text-[10px] mt-0.5">04</span> {isEn ? 'Do not use for spam, scam, or illegal activity.' : 'ห้ามใช้เพื่อสแปม หลอกลวง หรือกิจกรรมผิดกฎหมาย'}</li>
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
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">01</span> {isEn ? 'All data stored locally on your device only.' : 'ข้อมูลทั้งหมดจัดเก็บในเครื่องของคุณเท่านั้น'}</li>
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">02</span> {isEn ? 'Facebook session managed locally — your password is never stored.' : 'Session Facebook จัดการภายในเครื่อง — ไม่เก็บรหัสผ่าน'}</li>
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">03</span> {isEn ? 'Claude API Key sent only to Anthropic\'s API.' : 'Claude API Key ส่งตรงไปยัง Anthropic เท่านั้น'}</li>
                    <li className="flex items-start gap-2"><span className="text-green-500/60 font-mono text-[10px] mt-0.5">04</span> {isEn ? 'Export or delete your data anytime from Settings.' : 'ส่งออกหรือลบข้อมูลได้ตลอดเวลาจากหน้าตั้งค่า'}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </MachinePanel>

        {/* ═══ QUICK LINKS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: isEn ? 'Automation' : 'Automation', link: '/automation', icon: Zap, color: 'text-cyan-500' },
            { label: isEn ? 'Properties' : 'สินทรัพย์', link: '/properties', icon: Building2, color: 'text-blue-500' },
            { label: isEn ? 'Analytics' : 'วิเคราะห์', link: '/analytics', icon: BarChart3, color: 'text-violet-500' },
            { label: isEn ? 'Settings' : 'ตั้งค่า', link: '/settings', icon: Cog, color: 'text-slate-500' },
          ].map((item) => (
            <Link key={item.link} to={item.link}>
              <Button variant="outline" className="w-full justify-start gap-2 h-11 border-slate-200 dark:border-slate-700 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition-all font-mono text-xs">
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
          <p className="text-xs font-bold font-mono tracking-wider bg-gradient-to-r from-cyan-400 via-slate-400 to-cyan-400 bg-clip-text text-transparent">
            GRAND$TATE ENGINE
          </p>
          <p className="text-[9px] text-muted-foreground/60 font-mono tracking-[0.2em]">BUILD v2.0.0</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
