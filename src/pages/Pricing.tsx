import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Check,
  Zap,
  Crown,
  Rocket,
  Star,
  Clock,
  Shield,
  Sparkles,
  TrendingUp,
  X,
  Lock,
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { getUserPackage } from '@/hooks/usePackageLimits';
import { toast } from 'sonner';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

// ── Animated Counter ──
function AnimCounter({ target, duration = 1.2 }: { target: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView || target === 0) return;
    let start = 0;
    const step = target / (duration * 60);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [inView, target, duration]);

  return <span ref={ref}>{target === 0 ? '' : val.toLocaleString()}</span>;
}

// ── Color configs ──
const colorMap: Record<string, {
  glow: string; border: string; bg: string; text: string; icon: string;
  btnFrom: string; btnTo: string; shadow: string; scanVia: string; badgeBg: string; badgeText: string;
}> = {
  emerald: {
    glow: 'shadow-emerald-500/20', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10',
    text: 'text-emerald-400', icon: 'bg-emerald-500/20', btnFrom: 'from-emerald-500', btnTo: 'to-teal-500',
    shadow: 'shadow-emerald-500/25', scanVia: 'via-emerald-500/40', badgeBg: 'bg-emerald-500/15', badgeText: 'text-emerald-400',
  },
  amber: {
    glow: 'shadow-amber-500/20', border: 'border-amber-500/30', bg: 'bg-amber-500/10',
    text: 'text-amber-400', icon: 'bg-amber-500/20', btnFrom: 'from-amber-500', btnTo: 'to-orange-500',
    shadow: 'shadow-amber-500/25', scanVia: 'via-amber-500/40', badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-400',
  },
  purple: {
    glow: 'shadow-purple-500/20', border: 'border-purple-500/30', bg: 'bg-purple-500/10',
    text: 'text-purple-400', icon: 'bg-purple-500/20', btnFrom: 'from-purple-500', btnTo: 'to-pink-500',
    shadow: 'shadow-purple-500/25', scanVia: 'via-purple-500/40', badgeBg: 'bg-purple-500/15', badgeText: 'text-purple-400',
  },
};

interface PlanFeature { text: string; included: boolean; highlight?: boolean; }
interface Plan {
  id: string; name: string; nameEn: string; description: string; descriptionEn: string;
  price: number; priceLabel: string; priceLabelEn: string;
  postsPerDay: string; postsPerDayEn: string;
  icon: any; colorKey: string; popular?: boolean;
  features: PlanFeature[]; featuresEn: PlanFeature[];
}

const plans: Plan[] = [
  {
    id: 'rookie', name: 'Rookie', nameEn: 'Rookie',
    description: 'เริ่มต้นใช้งานฟรี เหมาะสำหรับมือใหม่', descriptionEn: 'Start for free, perfect for beginners',
    price: 0, priceLabel: 'ฟรี', priceLabelEn: 'Free',
    postsPerDay: '10 โพสต์/วัน', postsPerDayEn: '10 posts/day',
    icon: Rocket, colorKey: 'emerald',
    features: [
      { text: '10 โพสต์ต่อวัน', included: true },
      { text: 'เพิ่มสินทรัพย์ได้ 10 รายการ', included: true },
      { text: 'เพิ่มกลุ่มได้ 10 กลุ่ม', included: true },
      { text: 'รองรับ 2 ภาษา', included: true },
      { text: 'หลายบัญชี Facebook', included: false },
      { text: 'ตั้งเวลาโพสต์อัตโนมัติ', included: false },
      { text: 'Analytics & Reports', included: false },
      { text: 'Priority Support', included: false },
    ],
    featuresEn: [
      { text: '10 posts per day', included: true },
      { text: 'Up to 10 properties', included: true },
      { text: 'Up to 10 groups', included: true },
      { text: 'Bilingual Support', included: true },
      { text: 'Multiple Facebook Accounts', included: false },
      { text: 'Scheduled Posting', included: false },
      { text: 'Analytics & Reports', included: false },
      { text: 'Priority Support', included: false },
    ],
  },
  {
    id: 'agent', name: 'Top Agent', nameEn: 'Top Agent',
    description: 'สำหรับนายหน้ามืออาชีพ ที่ต้องการโพสต์มากขึ้น', descriptionEn: 'For professional agents who need more posts',
    price: 1490, priceLabel: '1,490 บาท/เดือน', priceLabelEn: '1,490 THB/month',
    postsPerDay: '300 โพสต์/วัน', postsPerDayEn: '300 posts/day',
    icon: Star, colorKey: 'amber', popular: true,
    features: [
      { text: '300 โพสต์ต่อวัน', included: true, highlight: true },
      { text: 'เพิ่มสินทรัพย์ได้ไม่จำกัด', included: true },
      { text: 'เพิ่มกลุ่มได้ 300 กลุ่ม', included: true },
      { text: 'รองรับ 2 ภาษา', included: true },
      { text: 'หลายบัญชี Facebook (3)', included: true },
      { text: 'ตั้งเวลาโพสต์อัตโนมัติ', included: true },
      { text: 'Analytics & Reports', included: true },
      { text: 'Priority Support', included: true },
    ],
    featuresEn: [
      { text: '300 posts per day', included: true, highlight: true },
      { text: 'Unlimited properties', included: true },
      { text: 'Up to 300 groups', included: true },
      { text: 'Bilingual Support', included: true },
      { text: 'Multiple Facebook Accounts (3)', included: true },
      { text: 'Scheduled Posting', included: true },
      { text: 'Analytics & Reports', included: true },
      { text: 'Priority Support', included: true },
    ],
  },
  {
    id: 'elite', name: 'Elite', nameEn: 'Elite',
    description: 'สำหรับเอเจนซี่และบริษัทอสังหาฯ ขนาดใหญ่', descriptionEn: 'For agencies and large real estate companies',
    price: 2990, priceLabel: '2,990 บาท/เดือน', priceLabelEn: '2,990 THB/month',
    postsPerDay: '750 โพสต์/วัน', postsPerDayEn: '750 posts/day',
    icon: Crown, colorKey: 'purple',
    features: [
      { text: '750 โพสต์ต่อวัน', included: true, highlight: true },
      { text: 'เพิ่มสินทรัพย์ได้ไม่จำกัด', included: true },
      { text: 'เพิ่มกลุ่มได้ 750 กลุ่ม', included: true },
      { text: 'รองรับ 2 ภาษา', included: true },
      { text: 'หลายบัญชี Facebook (5)', included: true, highlight: true },
      { text: 'ตั้งเวลาโพสต์อัตโนมัติ', included: true },
      { text: 'Analytics & Reports', included: true },
      { text: 'Priority Support 24/7', included: true, highlight: true },
    ],
    featuresEn: [
      { text: '750 posts per day', included: true, highlight: true },
      { text: 'Unlimited properties', included: true },
      { text: 'Up to 750 groups', included: true },
      { text: 'Bilingual Support', included: true },
      { text: 'Multiple Facebook Accounts (5)', included: true, highlight: true },
      { text: 'Scheduled Posting', included: true },
      { text: 'Analytics & Reports', included: true },
      { text: 'Priority Support 24/7', included: true, highlight: true },
    ],
  },
];

export default function Pricing() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const userPkg = getUserPackage();
  const currentPlan = userPkg === 'agent' ? 'agent' : userPkg === 'elite' ? 'elite' : 'rookie';

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) {
      toast.info(isEn ? 'This is your current plan' : 'นี่คือแพ็คเกจปัจจุบันของคุณ');
      return;
    }
    if (planId === 'rookie') { window.location.href = '/auth'; return; }
    window.open('https://line.me/ti/p/@897hrloe', '_blank');
  };

  return (
    <DashboardLayout
      title={isEn ? 'Pricing Plans' : 'แพ็คเกจราคา'}
      subtitle={isEn ? 'Choose the plan that fits your needs' : 'เลือกแพ็คเกจที่เหมาะกับคุณ'}
    >
      {/* ═══ DARK ENGINE WRAPPER ═══ */}
      <div className="relative -mx-4 -mt-2 px-4 pt-6 pb-12 rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 47% 4%) 100%)' }}>

        {/* Blueprint Grid BG */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Floating particles */}
        {[...Array(12)].map((_, i) => (
          <motion.div key={i}
            className="absolute w-1 h-1 rounded-full bg-accent/20 pointer-events-none"
            style={{ left: `${8 + i * 8}%`, top: `${10 + (i % 3) * 30}%` }}
            animate={{ y: [0, -20, 0], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}

        {/* ═══ HEADER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4 mb-12 relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isEn ? 'Select your engine spec' : 'เลือกสเปกเครื่องยนต์ของคุณ'}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            {isEn ? 'Transparent ' : 'ราคาชัดเจน '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              {isEn ? 'Pricing' : 'โปร่งใส'}
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm">
            {isEn
              ? 'Start free and upgrade when you need more power. All plans include our core features.'
              : 'เริ่มต้นใช้งานฟรี อัพเกรดเมื่อต้องการพลังเพิ่ม ทุกแพ็คเกจมีฟีเจอร์หลักครบครัน'}
          </p>
        </motion.div>

        {/* ═══ PLANS GRID ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto relative z-10">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const features = isEn ? plan.featuresEn : plan.features;
            const isCurrentPlan = plan.id === currentPlan;
            const c = colorMap[plan.colorKey];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 50, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="relative group"
              >
                <div className={cn(
                  'relative h-full rounded-[1.5rem] border-2 overflow-hidden transition-all duration-500',
                  'bg-slate-900/80 backdrop-blur-sm',
                  plan.popular ? cn(c.border, 'shadow-xl', c.glow) : 'border-slate-800 hover:border-slate-700',
                  isCurrentPlan && 'ring-2 ring-emerald-500/60',
                )}>

                  {/* ── Glow Orb ── */}
                  <div className={cn(
                    'absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] transition-all duration-700 pointer-events-none',
                    c.bg, 'opacity-40 group-hover:opacity-70'
                  )} />

                  {/* ── Scanning Line ── */}
                  <motion.div
                    animate={{ top: ['-10%', '110%'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: index * 0.5 }}
                    className={cn('absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent to-transparent pointer-events-none z-20', c.scanVia)}
                  />

                  {/* ── Popular Badge ── */}
                  {plan.popular && (
                    <div className="absolute top-0 right-0 z-20">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl shadow-lg uppercase tracking-widest">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        {isEn ? 'POPULAR' : 'ยอดนิยม'}
                      </div>
                    </div>
                  )}

                  {/* ── Current Badge ── */}
                  {isCurrentPlan && (
                    <div className="absolute top-0 left-0 z-20">
                      <div className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-br-xl shadow-lg uppercase tracking-widest">
                        <Check className="w-3 h-3 inline mr-1" />
                        {isEn ? 'ACTIVE' : 'ใช้งานอยู่'}
                      </div>
                    </div>
                  )}

                  {/* ── Content ── */}
                  <div className="relative z-10 p-7 pt-8">
                    {/* Icon */}
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 12 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-5', c.icon)}
                    >
                      <Icon className={cn('w-7 h-7', c.text)} />
                    </motion.div>

                    {/* Name + Description */}
                    <h3 className="text-xl font-black text-white mb-1">{isEn ? plan.nameEn : plan.name}</h3>
                    <p className="text-xs text-slate-400 mb-5">{isEn ? plan.descriptionEn : plan.description}</p>

                    {/* Price */}
                    <div className="flex items-baseline gap-1.5 mb-2">
                      {plan.price === 0 ? (
                        <span className={cn('text-4xl font-black', c.text)}>
                          {isEn ? 'Free' : 'ฟรี'}
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-white">
                            <AnimCounter target={plan.price} />
                          </span>
                          <span className="text-slate-400 text-sm">{isEn ? 'THB/mo' : 'บาท/เดือน'}</span>
                        </>
                      )}
                    </div>

                    {/* Posts per day badge */}
                    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold mb-6', c.badgeBg, c.badgeText)}>
                      <Zap className="w-3 h-3" />
                      {isEn ? plan.postsPerDayEn : plan.postsPerDay}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-800 mb-5" />

                    {/* Features */}
                    <ul className="space-y-3 mb-7">
                      {features.map((feature, fIdx) => (
                        <motion.li
                          key={fIdx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.15 + fIdx * 0.04 }}
                          className={cn(
                            'flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 -mx-2 transition-all duration-300',
                            !feature.included && 'group/lock cursor-not-allowed hover:bg-slate-800/60',
                            feature.included && 'hover:bg-slate-800/30',
                          )}
                        >
                          {feature.included ? (
                            <div className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                              feature.highlight ? cn(c.bg, c.text) : 'bg-slate-800 text-slate-400'
                            )}>
                              <Check className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-800/50 group-hover/lock:bg-amber-500/20 transition-colors">
                              <Lock className="w-2.5 h-2.5 text-slate-500 group-hover/lock:text-amber-400 transition-colors" />
                            </div>
                          )}
                          <span className={cn(
                            feature.included ? 'text-slate-300' : 'text-slate-500 group-hover/lock:text-slate-400 transition-colors',
                            feature.highlight && cn('font-semibold', c.text)
                          )}>
                            {feature.text}
                          </span>
                          {!feature.included && (
                            <span className="ml-auto text-[9px] font-bold text-amber-500/0 group-hover/lock:text-amber-500/80 transition-all duration-300 uppercase tracking-wider whitespace-nowrap">
                              {isEn ? 'Upgrade' : 'อัพเกรด'}
                            </span>
                          )}
                        </motion.li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button
                        className={cn(
                          'w-full h-12 font-black text-xs uppercase tracking-widest gap-2 rounded-xl transition-all duration-300',
                          isCurrentPlan
                            ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                            : cn('bg-gradient-to-r text-white shadow-lg hover:shadow-xl hover:scale-[1.02]',
                                c.btnFrom, c.btnTo, c.shadow),
                        )}
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCurrentPlan}
                      >
                        {isCurrentPlan
                          ? isEn ? 'Current Plan' : 'แพ็คเกจปัจจุบัน'
                          : plan.price === 0
                            ? isEn ? 'Start Engine' : 'สตาร์ทเครื่อง'
                            : isEn ? 'Upgrade — LINE' : 'อัพเกรด — LINE'}
                        {!isCurrentPlan && <ArrowRight className="w-4 h-4" />}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ═══ WHY SECTION ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="max-w-6xl mx-auto mt-12 relative z-10"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-8 overflow-hidden relative">
            <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-accent/5 blur-[60px] pointer-events-none" />
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-accent" />
              {isEn ? 'Why GrandState Engine?' : 'ทำไมต้อง GrandState Engine?'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Clock, color: 'bg-blue-500/10', iconColor: 'text-blue-400', title: isEn ? 'Save Time' : 'ประหยัดเวลา', desc: isEn ? 'Automate posting to multiple groups in minutes' : 'โพสต์หลายกลุ่มอัตโนมัติในไม่กี่นาที' },
                { icon: TrendingUp, color: 'bg-emerald-500/10', iconColor: 'text-emerald-400', title: isEn ? 'Increase Sales' : 'เพิ่มยอดขาย', desc: isEn ? 'Reach more potential buyers with wider coverage' : 'เข้าถึงผู้ซื้อได้มากขึ้นด้วยการกระจายโพสต์' },
                { icon: Shield, color: 'bg-purple-500/10', iconColor: 'text-purple-400', title: isEn ? 'Safe & Reliable' : 'ปลอดภัย & เสถียร', desc: isEn ? 'Built-in safety features to protect your account' : 'ระบบป้องกันบัญชีถูกแบนในตัว' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors">
                  <motion.div whileHover={{ scale: 1.1, rotate: 5 }}
                    className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', item.color)}>
                    <item.icon className={cn('w-5 h-5', item.iconColor)} />
                  </motion.div>
                  <div>
                    <p className="font-semibold text-white text-sm">{item.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ═══ CONTACT ═══ */}
        <div className="text-center py-8 relative z-10">
          <p className="text-slate-400 text-sm">
            {isEn ? 'Questions? Contact us via' : 'มีคำถาม? ติดต่อเราได้ที่'}{' '}
            <a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer"
              className="text-accent hover:underline inline-flex items-center gap-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE @grandstate
            </a>
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-3 tracking-widest">GRAND$TATE ENGINE v1.0</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
