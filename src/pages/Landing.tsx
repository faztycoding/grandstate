import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GrandStateLogo } from '@/components/GrandStateLogo';
import {
  Building2,
  Sparkles,
  Users,
  Shield,
  Clock,
  ArrowRight,
  Check,
  Zap,
  BarChart3,
  Store,
  Lock,
  Rocket,
  Star,
  Crown,
  MessageCircle,
  Cpu,
  Globe,
  TrendingUp,
  BrainCircuit,
  Timer,
  ChevronDown,
} from 'lucide-react';
import { motion, useInView, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════
   PARTICLE CANVAS — Quantum Entry Effect
   ═══════════════════════════════════════════ */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string; life: number }[] = [];
    const PARTICLE_COUNT = 80;
    const colors = ['#f7b500', '#a855f7', '#6366f1', '#f7b500', '#c084fc'];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: Math.random() * 100,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += 0.5;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const pulse = Math.sin(p.life * 0.05) * 0.3 + 0.7;
        ctx.globalAlpha = p.alpha * pulse;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.08;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

/* ═══════════════════════════════════════════
   CASCADING NUMBER — Slot Machine Counter
   ═══════════════════════════════════════════ */
function CascadingNumber({ value, suffix = '', duration = 2 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionVal, value, { duration, ease: 'easeOut' });
    const unsub = rounded.on('change', (v) => setDisplay(String(v)));
    return () => { controls.stop(); unsub(); };
  }, [inView, value, duration, motionVal, rounded]);

  return <span ref={ref}>{display}{suffix}</span>;
}

/* ═══════════════════════════════════════════
   GLOW VORTEX — Animated energy ring
   ═══════════════════════════════════════════ */
function GlowVortex() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none" aria-hidden>
      {/* Outer ring */}
      <div className="w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full vortex-ring opacity-30"
        style={{ background: 'conic-gradient(from 0deg, transparent, hsl(38 92% 50% / 0.15), transparent, hsl(270 60% 50% / 0.1), transparent)' }} />
      {/* Middle ring */}
      <div className="absolute inset-16 md:inset-24 rounded-full vortex-ring-reverse opacity-40"
        style={{ background: 'conic-gradient(from 90deg, transparent, hsl(270 60% 50% / 0.2), transparent, hsl(38 92% 50% / 0.15), transparent)' }} />
      {/* Core glow */}
      <div className="absolute inset-32 md:inset-48 rounded-full"
        style={{ background: 'radial-gradient(circle, hsl(38 92% 50% / 0.12) 0%, hsl(270 60% 50% / 0.06) 50%, transparent 70%)', animation: 'glowBreathe 4s ease-in-out infinite' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   NEURAL FLOW — AI Core + Light Trails SVG
   ═══════════════════════════════════════════ */
function NeuralFlowViz() {
  return (
    <div className="relative w-full h-[400px] md:h-[500px] overflow-hidden rounded-2xl">
      {/* Background grid */}
      <div className="absolute inset-0 data-circuit opacity-60" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, hsl(270 60% 50% / 0.08) 0%, transparent 60%)' }} />

      {/* SVG Neural Network */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="hsl(270 60% 50%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="trailGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(38 92% 50%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trailPurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(270 60% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(270 60% 60%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(270 60% 60%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Connection lines */}
        {[
          'M400,250 Q300,150 150,120',
          'M400,250 Q500,150 650,120',
          'M400,250 Q300,350 150,380',
          'M400,250 Q500,350 650,380',
          'M400,250 Q250,250 100,250',
          'M400,250 Q550,250 700,250',
        ].map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke="hsl(270 60% 50% / 0.15)" strokeWidth="1.5" />
            {/* Animated light dot */}
            <circle r="3" fill={i % 2 === 0 ? 'hsl(38 92% 50%)' : 'hsl(270 60% 60%)'} opacity="0.9">
              <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" path={d} />
            </circle>
            <circle r="6" fill={i % 2 === 0 ? 'hsl(38 92% 50% / 0.3)' : 'hsl(270 60% 60% / 0.3)'}>
              <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        ))}

        {/* AI Core */}
        <circle cx="400" cy="250" r="60" fill="url(#coreGlow)" />
        <circle cx="400" cy="250" r="35" fill="none" stroke="hsl(38 92% 50% / 0.4)" strokeWidth="2" strokeDasharray="8 4">
          <animateTransform attributeName="transform" type="rotate" from="0 400 250" to="360 400 250" dur="10s" repeatCount="indefinite" />
        </circle>
        <circle cx="400" cy="250" r="22" fill="none" stroke="hsl(270 60% 60% / 0.5)" strokeWidth="1.5" strokeDasharray="4 6">
          <animateTransform attributeName="transform" type="rotate" from="360 400 250" to="0 400 250" dur="8s" repeatCount="indefinite" />
        </circle>
        <text x="400" y="254" textAnchor="middle" fill="hsl(38 92% 50%)" fontSize="11" fontWeight="bold" opacity="0.9">AI CORE</text>

        {/* End nodes */}
        {[
          { x: 150, y: 120, label: 'Groups', icon: '👥' },
          { x: 650, y: 120, label: 'MKT', icon: '🏪' },
          { x: 150, y: 380, label: 'Data', icon: '📊' },
          { x: 650, y: 380, label: 'Posts', icon: '📝' },
          { x: 100, y: 250, label: 'Users', icon: '👤' },
          { x: 700, y: 250, label: 'Cloud', icon: '☁️' },
        ].map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="28" fill="hsl(var(--card) / 0.8)" stroke="hsl(270 60% 50% / 0.3)" strokeWidth="1.5" />
            <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="14">{n.icon}</text>
            <text x={n.x} y={n.y + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600">{n.label}</text>
          </g>
        ))}
      </svg>

      {/* Mini post cards floating up */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute w-24 h-8 rounded-md bg-background/80 backdrop-blur border border-accent/20 flex items-center gap-1.5 px-2 shadow-lg"
          style={{ left: `${15 + i * 30}%`, bottom: '5%' }}
          animate={{ y: [0, -280, -280], opacity: [0, 1, 0], scale: [0.8, 1, 0.9] }}
          transition={{ duration: 4, delay: i * 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0" />
          <div className="flex-1 space-y-0.5">
            <div className="h-1 bg-foreground/20 rounded w-full" />
            <div className="h-1 bg-foreground/10 rounded w-3/4" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const features = [
  {
    icon: Building2,
    title: 'จัดการทรัพย์สิน',
    titleEn: 'Property Management',
    description: 'เพิ่มข้อมูล ราคา รูปภาพ สิ่งอำนวยความสะดวก ครบจบในที่เดียว ข้อมูล Sync ข้ามอุปกรณ์ผ่าน Cloud',
    descriptionEn: 'Add details, pricing, photos & amenities in one place. Data syncs across devices via Cloud.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Sparkles,
    title: 'AI สร้างแคปชั่น',
    titleEn: 'AI Caption Generator',
    description: 'Claude AI สร้างแคปชั่นภาษาไทยหลากหลายสไตล์ ไม่ซ้ำกัน เหมือนพิมพ์เอง ไม่โดนแบน',
    descriptionEn: 'Claude AI generates unique Thai captions in various styles — looks human-written, no bans.',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: Users,
    title: 'จัดการกลุ่ม Facebook',
    titleEn: 'Group Management',
    description: 'เพิ่มกลุ่มด้วย URL ดึงข้อมูลอัตโนมัติ แบ่ง Active/Inactive จัดการกลุ่มได้สูงสุด 750 กลุ่ม',
    descriptionEn: 'Add groups by URL, auto-fetch info, manage Active/Inactive — up to 750 groups.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Zap,
    title: 'โพสต์อัตโนมัติ',
    titleEn: 'Auto Posting',
    description: 'โพสต์ลงกลุ่ม Facebook + Marketplace อัตโนมัติ มี delay แบบมนุษย์ ป้องกันตรวจจับ',
    descriptionEn: 'Auto-post to Facebook Groups + Marketplace with human-like delays to avoid detection.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Clock,
    title: 'ตั้งเวลาโพสต์',
    titleEn: 'Smart Scheduling',
    description: 'ตั้งเวลาล่วงหน้า ระบบโพสต์ให้อัตโนมัติตามเวลาที่กำหนด ไม่ต้องเฝ้าหน้าจอ',
    descriptionEn: 'Schedule ahead — system posts automatically at your chosen time, no babysitting.',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: Store,
    title: 'Marketplace',
    titleEn: 'Facebook Marketplace',
    description: 'ลงประกาศ Marketplace พร้อมเลือกกลุ่มอัตโนมัติ ครอบคลุมผู้ซื้อมากขึ้น 10 เท่า',
    descriptionEn: 'List on Marketplace with auto group selection — reach 10x more buyers.',
    gradient: 'from-indigo-500 to-blue-500',
  },
];

const stats = [
  { number: '750+', label: 'โพสต์ / วัน', labelEn: 'Posts / Day', sublabel: 'แพ็กเกจ Elite', sublabelEn: 'Elite package' },
  { number: '10x', label: 'ประหยัดเวลา', labelEn: 'Time Saved', sublabel: 'เทียบกับโพสต์มือ', sublabelEn: 'vs manual posting' },
  { number: '24/7', label: 'ทำงานอัตโนมัติ', labelEn: 'Auto Posting', sublabel: 'ตั้งเวลาได้', sublabelEn: 'with scheduling' },
  { number: '100%', label: 'ข้อมูลแยก', labelEn: 'Data Isolated', sublabel: 'ปลอดภัยต่อ user', sublabelEn: 'per-user security' },
];

const packages = [
  {
    name: 'Rookie',
    nameEn: 'Rookie',
    icon: Rocket,
    price: 0,
    priceLabel: 'ฟรี',
    priceLabelEn: 'Free',
    period: '',
    periodEn: '',
    color: 'from-emerald-500 to-teal-500',
    features: [
      { th: '10 โพสต์/วัน', en: '10 posts/day' },
      { th: '10 กลุ่ม', en: '10 groups' },
      { th: '10 ทรัพย์สิน', en: '10 properties' },
      { th: '1 บัญชี Facebook', en: '1 Facebook account' },
      { th: 'โพสต์กลุ่ม', en: 'Group posting' },
    ],
  },
  {
    name: 'Top Agent',
    nameEn: 'Top Agent',
    icon: Star,
    price: 990,
    priceLabel: '990',
    priceLabelEn: '990',
    period: '/ เดือน',
    periodEn: '/ month',
    color: 'from-amber-500 to-orange-500',
    popular: true,
    features: [
      { th: '300 โพสต์/วัน', en: '300 posts/day', highlight: true },
      { th: '300 กลุ่ม', en: 'Up to 300 groups' },
      { th: 'ไม่จำกัดทรัพย์สิน', en: 'Unlimited properties' },
      { th: '3 บัญชี Facebook', en: '3 Facebook accounts', highlight: true },
      { th: 'กลุ่ม + Marketplace', en: 'Groups + Marketplace' },
      { th: 'AI แคปชั่น', en: 'AI captions' },
      { th: 'ตั้งเวลาโพสต์', en: 'Scheduled posting' },
    ],
  },
  {
    name: 'Elite',
    nameEn: 'Elite',
    icon: Crown,
    price: 2990,
    priceLabel: '2,990',
    priceLabelEn: '2,990',
    period: '/ เดือน',
    periodEn: '/ month',
    color: 'from-purple-500 to-pink-500',
    features: [
      { th: '750 โพสต์/วัน', en: '750 posts/day', highlight: true },
      { th: '750 กลุ่ม', en: 'Up to 750 groups' },
      { th: 'ไม่จำกัดทรัพย์สิน', en: 'Unlimited properties' },
      { th: '5 บัญชี Facebook', en: '5 Facebook accounts', highlight: true },
      { th: 'กลุ่ม + Marketplace', en: 'Groups + Marketplace' },
      { th: 'AI แคปชั่น', en: 'AI captions' },
      { th: 'ตั้งเวลาโพสต์', en: 'Scheduled posting' },
      { th: 'สถิติวิเคราะห์', en: 'Analytics & reports' },
      { th: 'Priority Support 24/7', en: 'Priority Support 24/7', highlight: true },
    ],
  },
];

const benefits = [
  { text: 'ประหยัดเวลา 3-4 ชม./วัน ไม่ต้องนั่งโพสต์เอง', textEn: 'Save 3-4 hours/day — no manual posting', icon: Clock },
  { text: 'เข้าถึงผู้ซื้อมากขึ้น 10 เท่าผ่าน Groups + Marketplace', textEn: 'Reach 10x more buyers via Groups + Marketplace', icon: Users },
  { text: 'AI สร้างแคปชั่นภาษาไทย ไม่ซ้ำ ไม่โดนแบน', textEn: 'AI generates unique Thai captions — no bans', icon: Sparkles },
  { text: 'ข้อมูลแยกต่อ user ปลอดภัย 100% ไม่ปนกัน', textEn: '100% data isolation per user — fully secure', icon: Lock },
  { text: 'สถิติวิเคราะห์ ดูผลโพสต์แบบ real-time', textEn: 'Real-time analytics & posting insights', icon: BarChart3 },
  { text: 'ทีมซัพพอร์ตตอบเร็ว ผ่าน LINE', textEn: 'Fast support via LINE', icon: MessageCircle },
];

export default function Landing() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header — Cinematic glassmorphism */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 md:gap-3 group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <GrandStateLogo heroMode={!scrolled} className="w-10 h-10 md:w-11 md:h-11 drop-shadow-lg" />
            </motion.div>
            <span className={`font-bold text-lg md:text-xl transition-colors duration-500 ${scrolled ? 'text-foreground' : 'text-white'}`}>
              Grand<span className="text-amber-500">$</span>tate
            </span>
          </Link>
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher heroMode={!scrolled} />
            <Button variant="ghost" size="sm" asChild className={`hidden sm:inline-flex transition-colors duration-500 ${scrolled ? '' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
              <Link to="/auth">{isEn ? 'Sign In' : 'เข้าสู่ระบบ'}</Link>
            </Button>
            <Link to="/auth" className={`inline-flex items-center gap-1 md:gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-500 shadow-lg ${scrolled ? 'btn-glass text-accent' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-amber-500/30 hover:scale-105'}`}>
              <span className="sm:hidden">{isEn ? 'Sign In' : 'เข้าสู่ระบบ'}</span>
              <span className="hidden sm:inline">{isEn ? 'Get Started' : 'เริ่มต้นใช้งาน'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════ HERO — Cinematic Video Background ═══════════════ */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        {/* Full-screen video background */}
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'%3E%3Crect fill='%23111827'/%3E%3C/svg%3E"
        >
          <source src="https://assets.website-files.com/6212e7201b7300b545f9620c/632c6ab96010264be580f403_chicago-transcode.mp4" type="video/mp4" />
        </video>

        {/* Cinematic overlays — multi-layer gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900/20 via-transparent to-purple-900/20 z-[1]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent z-[2]" />

        {/* Particle overlay on top of video */}
        <div className="absolute inset-0 z-[2]"><ParticleCanvas /></div>

        {/* Subtle vignette */}
        <div className="absolute inset-0 z-[1]" style={{ boxShadow: 'inset 0 0 200px 60px rgba(0,0,0,0.5)' }} />

        {/* Hero content */}
        <div className="container mx-auto px-6 text-center relative z-10 pt-20">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Top badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Badge className="mb-8 bg-white/10 text-white/90 border-white/20 backdrop-blur-md text-sm px-5 py-1.5 shadow-lg" variant="outline">
                🇹🇭 {isEn ? 'Built for Thai Real Estate Agents' : 'สำหรับนายหน้าอสังหาฯ ไทยโดยเฉพาะ'}
              </Badge>
            </motion.div>

            {/* Main heading — cinematic */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 leading-[0.95] tracking-tight text-white drop-shadow-2xl">
              <motion.span
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="block"
              >
                {isEn ? 'Auto-Post' : 'โพสต์อสังหาฯ'}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="block"
                style={{ background: 'linear-gradient(135deg, #f7b500, #f59e0b, #d97706, #f7b500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 8px rgba(247,181,0,0.4))' }}
              >
                {isEn ? 'Real Estate' : 'อัตโนมัติ'}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="block text-3xl md:text-4xl lg:text-5xl font-bold mt-3 text-white/80"
              >
                {isEn ? 'Smarter. Faster. Safer.' : 'ฉลาดกว่า เร็วกว่า ปลอดภัยกว่า'}
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              {isEn
                ? 'Auto-post properties to Facebook Groups + Marketplace with AI captions. Save time, boost sales.'
                : 'ระบบช่วยโพสต์อสังหาริมทรัพย์ไปยัง Facebook Groups + Marketplace\nอัตโนมัติ พร้อม AI สร้างแคปชั่น ประหยัดเวลา เพิ่มยอดขาย'}
            </motion.p>

            {/* CTA buttons — glassmorphism on dark */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/auth" className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 transition-all duration-300 btn-shine">
                {isEn ? 'Start Free' : 'เริ่มต้นใช้งานฟรี'}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-base font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg">
                {isEn ? 'View Plans' : 'ดูแพ็กเกจ'}
                <Crown className="w-5 h-5" />
              </Link>
            </motion.div>

            {/* Floating glass stat mini-cards below CTA */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.7 }}
              className="mt-16 flex flex-wrap justify-center gap-3 md:gap-4"
            >
              {[
                { val: '750+', lab: isEn ? 'Posts/Day' : 'โพสต์/วัน', Icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                { val: 'AI', lab: isEn ? 'Captions' : 'แคปชั่น', Icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                { val: '10x', lab: isEn ? 'Faster' : 'เร็วขึ้น', Icon: Rocket, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                { val: '24/7', lab: isEn ? 'Auto' : 'อัตโนมัติ', Icon: Timer, color: 'text-sky-400', bg: 'bg-sky-400/10' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 + i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-6 py-4 text-center min-w-[110px] hover:bg-white/[0.1] hover:border-white/15 transition-all duration-300 group"
                >
                  <div className={`w-9 h-9 mx-auto mb-2 rounded-xl ${s.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <s.Icon className={`w-4.5 h-4.5 ${s.color}`} />
                  </div>
                  <p className="text-white font-bold text-lg leading-tight">{s.val}</p>
                  <p className="text-white/45 text-[11px] mt-0.5">{s.lab}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Scroll indicator — hides on scroll */}
          <AnimatePresence>
            {!scrolled && (
              <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4 }}
                animate={{ y: [0, 10, 0] }}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-widest">{isEn ? 'Scroll' : 'เลื่อนลง'}</span>
                  <div className="w-7 h-11 rounded-full border-2 border-white/20 flex justify-center pt-2 backdrop-blur-sm">
                    <motion.div
                      className="w-1 h-2.5 rounded-full bg-amber-400/80"
                      animate={{ y: [0, 6, 0], opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ═══════════════ STATS — 3D Neon Modules ═══════════════ */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 data-circuit opacity-20" />
        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { value: 750, suffix: '+', label: isEn ? 'Posts / Day' : 'โพสต์ / วัน', sublabel: isEn ? 'Elite package' : 'แพ็กเกจ Elite', iconType: 'gear' },
              { value: 10, suffix: 'x', label: isEn ? 'Time Saved' : 'ประหยัดเวลา', sublabel: isEn ? 'vs manual posting' : 'เทียบกับโพสต์มือ', iconType: 'pulse' },
              { value: 24, suffix: '/7', label: isEn ? 'Auto Posting' : 'ทำงานอัตโนมัติ', sublabel: isEn ? 'with scheduling' : 'ตั้งเวลาได้', iconType: 'clock' },
              { value: 100, suffix: '%', label: isEn ? 'Data Isolated' : 'ข้อมูลแยก', sublabel: isEn ? 'per-user security' : 'ปลอดภัยต่อ user', iconType: 'shield' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 60, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: index * 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="neon-card rounded-2xl p-5 md:p-6 text-center relative overflow-hidden group"
              >
                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" style={{ animation: 'shimmer 2s ease-in-out infinite' }} />
                </div>
                {/* Icon animation */}
                <div className="w-10 h-10 mx-auto mb-3 relative">
                  {stat.iconType === 'gear' && (
                    <div className="w-full h-full">
                      <svg viewBox="0 0 40 40" className="w-full h-full" style={{ animation: 'gearSpin 8s linear infinite' }}>
                        <path d="M20 6 L22 10 L26 8 L26 12 L30 12 L28 16 L32 18 L28 20 L30 24 L26 24 L26 28 L22 26 L20 30 L18 26 L14 28 L14 24 L10 24 L12 20 L8 18 L12 16 L10 12 L14 12 L14 8 L18 10 Z" fill="none" stroke="hsl(38 92% 50% / 0.6)" strokeWidth="1.5" />
                        <circle cx="20" cy="18" r="5" fill="none" stroke="hsl(38 92% 50% / 0.4)" strokeWidth="1.5" />
                      </svg>
                    </div>
                  )}
                  {stat.iconType === 'pulse' && (
                    <div className="w-full h-full flex items-center justify-center" style={{ animation: 'organicPulse 3s ease-in-out infinite' }}>
                      <svg viewBox="0 0 40 40" className="w-full h-full">
                        <circle cx="20" cy="20" r="12" fill="hsl(270 60% 60% / 0.15)" stroke="hsl(270 60% 60% / 0.5)" strokeWidth="1.5" />
                        <circle cx="20" cy="20" r="6" fill="hsl(270 60% 60% / 0.3)" />
                      </svg>
                    </div>
                  )}
                  {stat.iconType === 'clock' && (
                    <div className="w-full h-full">
                      <svg viewBox="0 0 40 40" className="w-full h-full">
                        <circle cx="20" cy="20" r="14" fill="none" stroke="hsl(38 92% 50% / 0.4)" strokeWidth="1.5" />
                        <line x1="20" y1="20" x2="20" y2="10" stroke="hsl(38 92% 50% / 0.7)" strokeWidth="2" strokeLinecap="round" style={{ transformOrigin: '20px 20px', animation: 'clockSweep 4s linear infinite' }} />
                        <line x1="20" y1="20" x2="26" y2="20" stroke="hsl(270 60% 60% / 0.6)" strokeWidth="1.5" strokeLinecap="round" style={{ transformOrigin: '20px 20px', animation: 'clockSweep 60s linear infinite' }} />
                        <circle cx="20" cy="20" r="2" fill="hsl(38 92% 50% / 0.6)" />
                      </svg>
                    </div>
                  )}
                  {stat.iconType === 'shield' && (
                    <div className="w-full h-full flex items-center justify-center">
                      <Shield className="w-7 h-7 text-emerald-500/70" />
                    </div>
                  )}
                </div>
                <p className="text-3xl md:text-4xl font-bold gradient-text tabular-nums">
                  <CascadingNumber value={stat.value} suffix={stat.suffix} duration={2.5} />
                </p>
                <p className="font-semibold mt-1 text-sm">{stat.label}</p>
                <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ NEURAL FLOW — AI Core (Mysterious) ═══════════════ */}
      <section className="py-24 px-6 relative overflow-hidden bg-gradient-to-b from-background via-black/5 to-background dark:from-background dark:via-purple-950/10 dark:to-background">
        {/* Subtle radial glow */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, hsl(270 60% 50% / 0.06) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 data-circuit opacity-10" />

        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-4 bg-purple-500/10 text-purple-500 border-purple-500/20 backdrop-blur-sm" variant="outline">
                <Cpu className="w-3 h-3 mr-1" />
                {isEn ? 'Classified Technology' : 'เทคโนโลยีเฉพาะ'}
              </Badge>
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
              {isEn ? 'The AI Behind ' : 'เบื้องหลัง '}
              <span style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {isEn ? 'Everything' : 'ทุกสิ่ง'}
              </span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {isEn
                ? 'Our proprietary AI Core processes, generates, and distributes — all in milliseconds. Some things are better left unseen.'
                : 'AI Core ประมวลผล สร้างแคปชั่น และกระจายโพสต์ในเสี้ยววินาที บางสิ่ง... ดีกว่าไม่ต้องเห็น'}
            </p>
          </motion.div>

          {/* AI Core Visualization — Mysterious */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="rounded-3xl border border-purple-500/10 overflow-hidden shadow-2xl shadow-purple-500/5 bg-gradient-to-br from-background to-purple-950/5 dark:to-purple-950/20">
              <NeuralFlowViz />

              {/* Mysterious fog overlay on bottom half — 50% revealed, 50% hidden */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background via-background/95 to-transparent z-10 flex items-end justify-center pb-8">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-medium tracking-wide">{isEn ? 'Full architecture classified' : 'สถาปัตยกรรมเต็มรูปแบบ — ปกปิด'}</span>
                  </div>
                  <Link to="/auth" className="text-xs text-purple-500 hover:text-purple-400 transition-colors font-medium">
                    {isEn ? 'Sign up to explore →' : 'สมัครเพื่อสัมผัส →'}
                  </Link>
                </motion.div>
              </div>
            </div>

            {/* Floating capability badges around the visualization */}
            <div className="hidden md:block">
              {[
                { label: isEn ? 'Caption AI' : 'AI แคปชั่น', x: '-left-4 top-1/4', delay: 0.2, color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20' },
                { label: isEn ? 'Auto-Post' : 'โพสต์อัตโนมัติ', x: '-right-4 top-1/3', delay: 0.4, color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20' },
                { label: isEn ? 'Smart Queue' : 'คิวอัจฉริยะ', x: '-left-2 bottom-1/3', delay: 0.6, color: 'from-blue-500/20 to-blue-500/5 border-blue-500/20' },
                { label: isEn ? 'Data Sync' : 'ซิงค์ข้อมูล', x: '-right-2 bottom-1/4', delay: 0.8, color: 'from-purple-500/20 to-purple-500/5 border-purple-500/20' },
              ].map((badge, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: badge.delay, duration: 0.5 }}
                  className={`absolute ${badge.x} z-20`}
                >
                  <div className={`bg-gradient-to-br ${badge.color} backdrop-blur-xl rounded-xl px-4 py-2 border text-xs font-semibold shadow-lg`}>
                    {badge.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Mystery metrics row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: isEn ? 'Processing Speed' : 'ความเร็วประมวลผล', value: '<0.3s', icon: Zap },
              { label: isEn ? 'Concurrent Posts' : 'โพสต์พร้อมกัน', value: '∞', icon: Globe },
              { label: isEn ? 'AI Models' : 'โมเดล AI', value: '█████', redacted: true, icon: Cpu },
              { label: isEn ? 'Architecture' : 'สถาปัตยกรรม', value: '██████', redacted: true, icon: Lock },
            ].map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="rounded-xl border border-border/50 p-4 text-center bg-background/50 backdrop-blur-sm hover:border-purple-500/20 transition-colors group"
              >
                <m.icon className="w-5 h-5 mx-auto mb-2 text-purple-500/60 group-hover:text-purple-500 transition-colors" />
                <p className={`text-xl font-bold ${m.redacted ? 'text-muted-foreground/30 select-none blur-[2px]' : 'text-foreground'}`}>{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ FEATURES — Card Grid ═══════════════ */}
      <section className="py-20 px-6 relative">
        <div className="absolute inset-0 data-circuit opacity-10" />
        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20" variant="outline">
              {isEn ? 'Full-Featured' : 'ฟีเจอร์ครบครัน'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {isEn ? 'Every Tool an Agent Needs' : 'ทุกเครื่องมือที่นายหน้าต้องการ'}
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {isEn ? 'All-in-one app: properties, groups, posting, analytics — everything in one place.' : 'ครบจบในแอปเดียว จัดการทรัพย์สิน กลุ่ม โพสต์ สถิติ ทั้งหมดในที่เดียว'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="h-full card-glow overflow-hidden group relative">
                  {/* Shimmer on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" style={{ animation: 'shimmer 2.5s ease-in-out infinite' }} />
                  </div>
                  <CardContent className="p-6 relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}
                    >
                      <feature.icon className="w-6 h-6 text-white" />
                    </motion.div>
                    <h3 className="text-lg font-semibold mb-1">{isEn ? feature.titleEn : feature.title}</h3>
                    {!isEn && <p className="text-xs text-muted-foreground/60 mb-2">{feature.titleEn}</p>}
                    <p className="text-muted-foreground text-sm">{isEn ? feature.descriptionEn : feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ BENEFITS — Why Grand$tate ═══════════════ */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-muted/30" />
        <div className="absolute inset-0 data-circuit opacity-10" />
        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Badge className="mb-4 bg-accent/10 text-accent border-accent/20" variant="outline">
                {isEn ? 'Why Grand$tate?' : 'ทำไมต้อง Grand$tate?'}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                {isEn ? 'Focus on Selling' : 'มุ่งเน้นขาย'}<br />
                <span className="gradient-text">{isEn ? 'Let the system post for you' : 'ปล่อยให้ระบบโพสต์ให้'}</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                {isEn
                  ? 'Stop wasting time copy-pasting to groups. Grand$tate works for you while you focus on closing deals.'
                  : 'หยุดเสียเวลานั่ง copy-paste ทีละกลุ่ม Grand$tate ทำงานแทนคุณ ขณะที่คุณโฟกัสกับการปิดดีลและดูแลลูกค้า'}
              </p>
              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={benefit.text}
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-4 h-4 text-accent" />
                    </div>
                    <span className="font-medium text-sm">{isEn ? benefit.textEn : benefit.text}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="aspect-[4/3] rounded-2xl neon-card p-6 md:p-8 flex flex-col justify-center relative overflow-hidden">
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" animate={{ x: ['-100%', '200%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
                <div className="space-y-3 relative">
                  {[
                    { icon: Building2, grad: 'from-blue-500 to-cyan-500', title: isEn ? 'Added 5 properties' : 'เพิ่มทรัพย์สิน 5 รายการ', sub: isEn ? 'Photos + details complete' : 'รูปภาพ + รายละเอียดครบ', done: true, delay: 0.1 },
                    { icon: Users, grad: 'from-amber-500 to-orange-500', title: isEn ? 'Selected 50 target groups' : 'เลือก 50 กลุ่มเป้าหมาย', sub: isEn ? 'Bangkok + surrounding areas' : 'กรุงเทพ + ปริมณฑล', done: true, delay: 0.25 },
                    { icon: Zap, grad: 'from-emerald-500 to-teal-500', title: isEn ? 'Posting... 23/50 groups' : 'กำลังโพสต์... 23/50 กลุ่ม', sub: isEn ? 'AI generates unique caption per group' : 'AI สร้างแคปชั่นให้แต่ละกลุ่ม', active: true, delay: 0.4 },
                    { icon: BarChart3, grad: 'from-violet-500 to-purple-500', title: isEn ? 'View posting analytics' : 'ดูสถิติผลโพสต์', sub: isEn ? 'Success 47 / Failed 3' : 'สำเร็จ 47 / ล้มเหลว 3', pending: true, delay: 0.55 },
                  ].map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: step.pending ? 0.5 : 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: step.delay }}
                      className={`flex items-center gap-3 p-3 rounded-xl bg-background/80 backdrop-blur shadow-sm ${step.active ? 'border-2 border-accent/30 neon-card' : ''}`}
                    >
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.grad} flex items-center justify-center shadow-md`}
                      >
                        <step.icon className="w-5 h-5 text-white" />
                      </motion.div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${step.active ? 'text-accent' : ''}`}>{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.sub}</p>
                      </div>
                      {step.done && <Check className="w-5 h-5 text-emerald-500" />}
                      {step.active && <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════ PACKAGES — Glassmorphism Cards ═══════════════ */}
      <section id="packages" className="py-20 px-6 relative scroll-mt-20">
        <div className="absolute inset-0 data-circuit opacity-10" />
        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20" variant="outline">
              {isEn ? 'Packages' : 'แพ็กเกจ'}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {isEn ? 'Choose the Right Plan' : 'เลือกแพ็กเกจที่เหมาะกับคุณ'}
            </h2>
            <p className="text-muted-foreground text-lg">
              {isEn ? 'Start free, upgrade when ready.' : 'เริ่มต้นฟรี อัพเกรดเมื่อพร้อม'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: index * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={pkg.popular ? 'md:-mt-4 md:mb-4' : ''}
              >
                <Card className={`h-full relative overflow-hidden transition-all duration-500 group ${pkg.popular ? 'neon-card border-accent shadow-xl shadow-accent/10 ring-1 ring-accent/20' : 'card-glow'}`}>
                  {pkg.popular && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-accent to-orange-500" />
                  )}
                  {/* Shimmer */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" style={{ animation: 'shimmer 2.5s ease-in-out infinite' }} />
                  </div>
                  <CardContent className="p-6 md:p-7 relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center shadow-lg`}
                      >
                        <pkg.icon className="w-6 h-6 text-white" />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-bold">{isEn ? pkg.nameEn : pkg.name}</h3>
                        {pkg.popular && <Badge className="bg-accent/10 text-accent text-[10px] h-5">{isEn ? 'Most Popular' : 'ยอดนิยม'}</Badge>}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5 pb-5 border-b border-border/50">
                      {pkg.price === 0 ? (
                        <div>
                          <span className="text-4xl font-extrabold">{isEn ? 'Free' : 'ฟรี'}</span>
                          <p className="text-xs text-muted-foreground mt-1">{isEn ? 'No credit card required' : 'ไม่ต้องผูกบัตร'}</p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-sm text-muted-foreground">฿</span>
                          <span className="text-4xl font-extrabold">{isEn ? pkg.priceLabelEn : pkg.priceLabel}</span>
                          <span className="text-muted-foreground text-sm ml-1">{isEn ? pkg.periodEn : pkg.period}</span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5">
                      {pkg.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-2.5 text-sm">
                          <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${f.highlight ? 'text-accent' : 'text-emerald-500'}`} />
                          <span className={f.highlight ? 'font-semibold' : ''}>{isEn ? f.en : f.th}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      to={pkg.price === 0 ? '/auth' : '/auth'}
                      className={`w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        pkg.popular
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02]'
                          : 'btn-glass'
                      }`}
                    >
                      {pkg.price === 0
                        ? (isEn ? 'Start Free' : 'เริ่มต้นฟรี')
                        : pkg.popular
                          ? (isEn ? 'Get Started' : 'เริ่มต้นเลย')
                          : (isEn ? 'Choose Plan' : 'เลือกแพ็กเกจ')
                      }
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    {/* Contact hint for paid plans */}
                    {pkg.price > 0 && (
                      <p className="text-center text-[10px] text-muted-foreground mt-2">
                        {isEn ? 'or contact via ' : 'หรือติดต่อทาง '}
                        <a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-medium">LINE</a>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECURITY — Shield ═══════════════ */}
      <section className="py-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-muted/30" />
        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-2xl mx-auto"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 10 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              {isEn ? 'Enterprise-Grade Security' : 'ปลอดภัยระดับ Enterprise'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isEn
                ? 'All data is encrypted and isolated per user. Browser sessions, posting data, and APIs are secured with JWT Authentication.'
                : 'ข้อมูลทุกอย่างเข้ารหัสและแยกต่อผู้ใช้ ไม่มีทางปนกัน Browser session แยก ข้อมูลโพสต์แยก API ป้องกันด้วย JWT Authentication'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['JWT Auth', 'SSL/HTTPS', 'Data Isolation', 'Rate Limiting', 'Stealth Mode'].map((tag, i) => (
                <motion.div
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Badge variant="outline" className="text-xs neon-card px-3 py-1">{tag}</Badge>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ CTA — Final Call ═══════════════ */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="gradient-hero text-white overflow-hidden relative">
              {/* Particle-like background dots */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(247,181,0,0.25)_0%,transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.15)_0%,transparent_50%)]" />
              <div className="absolute inset-0 dot-grid opacity-10" />
              {/* Moving shimmer */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              />
              <CardContent className="p-10 md:p-16 text-center relative z-10">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
                >
                  {isEn ? 'Ready to boost your real estate sales?' : 'พร้อมเพิ่มยอดขายอสังหาฯ หรือยัง?'}
                </motion.h2>
                <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
                  {isEn ? 'Start free today. No credit card required.' : 'เริ่มต้นฟรีวันนี้ ไม่ต้องผูกบัตร สมัครใช้งานได้เลย'}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/auth" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold bg-accent text-white shadow-xl shadow-accent/30 hover:shadow-accent/50 hover:scale-105 transition-all duration-300">
                    {isEn ? 'Start Free' : 'เริ่มต้นใช้งานฟรี'}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold border border-white/30 text-white hover:bg-white/10 hover:scale-105 transition-all duration-300 backdrop-blur-sm">
                    <MessageCircle className="w-5 h-5" />
                    {isEn ? 'Contact via LINE' : 'ติดต่อทาง LINE'}
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <GrandStateLogo className="w-10 h-10" />
                <span className="font-bold text-lg">Grand<span className="text-amber-500">$</span>tate</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isEn ? 'Auto real estate posting system' : 'ระบบโพสต์อสังหาริมทรัพย์อัตโนมัติ'}<br />
                {isEn ? 'for professional agents' : 'สำหรับนายหน้ามืออาชีพ'}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">{isEn ? 'Links' : 'ลิงก์'}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="hover:text-foreground transition-colors">{isEn ? 'Sign In' : 'เข้าสู่ระบบ'}</Link></li>
                <li><a href="#packages" className="hover:text-foreground transition-colors">{isEn ? 'Pricing' : 'แพ็กเกจและราคา'}</a></li>
                <li><a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{isEn ? 'Contact Us (LINE)' : 'ติดต่อเรา (LINE)'}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">{isEn ? 'Legal' : 'นโยบาย'}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">{isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors">{isEn ? 'Terms of Service' : 'ข้อตกลงการใช้งาน'}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {isEn ? '© 2026 Grand$tate — for professional real estate agents' : '© 2026 Grand$tate — สำหรับนายหน้าอสังหาริมทรัพย์มืออาชีพ'}
            </p>
            <p className="text-xs text-muted-foreground/50">Version 2.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
