import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Zap,
  Crown,
  Rocket,
  Star,
  Users,
  MessageSquare,
  Clock,
  Shield,
  Sparkles,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { getUserPackage } from '@/hooks/usePackageLimits';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface Plan {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  price: number;
  priceLabel: string;
  priceLabelEn: string;
  postsPerDay: string;
  postsPerDayEn: string;
  icon: any;
  color: string;
  gradient: string;
  popular?: boolean;
  features: PlanFeature[];
  featuresEn: PlanFeature[];
}

const plans: Plan[] = [
  {
    id: 'rookie',
    name: 'Rookie',
    nameEn: 'Rookie',
    description: 'เริ่มต้นใช้งานฟรี เหมาะสำหรับมือใหม่',
    descriptionEn: 'Start for free, perfect for beginners',
    price: 0,
    priceLabel: 'ฟรี',
    priceLabelEn: 'Free',
    postsPerDay: '10 โพสต์/วัน',
    postsPerDayEn: '10 posts/day',
    icon: Rocket,
    color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-teal-500',
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
    id: 'agent',
    name: 'Top Agent',
    nameEn: 'Top Agent',
    description: 'สำหรับนายหน้ามืออาชีพ ที่ต้องการโพสต์มากขึ้น',
    descriptionEn: 'For professional agents who need more posts',
    price: 1390,
    priceLabel: '1,390 บาท/เดือน',
    priceLabelEn: '1,390 THB/month',
    postsPerDay: '300 โพสต์/วัน',
    postsPerDayEn: '300 posts/day',
    icon: Star,
    color: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-500',
    popular: true,
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
    id: 'elite',
    name: 'Elite',
    nameEn: 'Elite',
    description: 'สำหรับเอเจนซี่และบริษัทอสังหาฯ ขนาดใหญ่',
    descriptionEn: 'For agencies and large real estate companies',
    price: 2990,
    priceLabel: '2,990 บาท/เดือน',
    priceLabelEn: '2,990 THB/month',
    postsPerDay: '750 โพสต์/วัน',
    postsPerDayEn: '750 posts/day',
    icon: Crown,
    color: 'text-purple-600',
    gradient: 'from-purple-500 to-pink-500',
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

    if (planId === 'rookie') {
      // Free plan - just navigate to auth
      window.location.href = '/auth';
      return;
    }

    // Paid plans - contact via LINE
    window.open('https://line.me/ti/p/@897hrloe', '_blank');
  };

  return (
    <DashboardLayout
      title={isEn ? 'Pricing Plans' : 'แพ็คเกจราคา'}
      subtitle={isEn ? 'Choose the plan that fits your needs' : 'เลือกแพ็คเกจที่เหมาะกับคุณ'}
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isEn ? 'Boost your real estate business' : 'เพิ่มยอดขายอสังหาฯ ของคุณ'}
            </span>
          </div>
          <h2 className="text-3xl font-bold">
            {isEn ? 'Simple, transparent pricing' : 'ราคาชัดเจน โปร่งใส'}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isEn
              ? 'Start free and upgrade when you need more. All plans include our core features.'
              : 'เริ่มต้นใช้งานฟรี อัพเกรดเมื่อต้องการใช้งานมากขึ้น ทุกแพ็คเกจมีฟีเจอร์หลักครบครัน'}
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const features = isEn ? plan.featuresEn : plan.features;
            const isCurrentPlan = plan.id === currentPlan;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
              <Card
                className={cn(
                  'relative overflow-hidden transition-all duration-500 group h-full card-hover-lift',
                  plan.popular && 'neon-card border-accent shadow-xl shadow-accent/10 scale-[1.03]',
                  !plan.popular && 'card-glow hover:shadow-lg',
                  isCurrentPlan && 'ring-2 ring-green-500'
                )}
              >
                {/* Shimmer on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" style={{ animation: 'shimmer 2.5s ease-in-out infinite' }} />
                </div>

                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl shadow-lg">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {isEn ? 'POPULAR' : 'ยอดนิยม'}
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 z-10">
                    <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-br-xl shadow-lg">
                      <Check className="w-3 h-3 inline mr-1" />
                      {isEn ? 'CURRENT' : 'ปัจจุบัน'}
                    </div>
                  </div>
                )}

                {/* Gradient Header */}
                <div className={cn('h-1.5 bg-gradient-to-r', plan.gradient)} />

                <CardHeader className="text-center pb-2 relative z-10">
                  {/* Icon */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className={cn(
                      'w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg',
                      plan.gradient
                    )}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </motion.div>

                  <CardTitle className="text-2xl">{isEn ? plan.nameEn : plan.name}</CardTitle>
                  <CardDescription>{isEn ? plan.descriptionEn : plan.description}</CardDescription>

                  {/* Price */}
                  <div className="pt-4">
                    {plan.price === 0 ? (
                      <div className={cn('text-4xl font-bold', plan.color)}>
                        {isEn ? 'Free' : 'ฟรี'}
                      </div>
                    ) : (
                      <div>
                        <span className="text-4xl font-bold">{plan.price.toLocaleString()}</span>
                        <span className="text-muted-foreground ml-1">
                          {isEn ? 'THB/mo' : 'บาท/เดือน'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Posts per day */}
                  <Badge variant="secondary" className={cn('mt-3',
                    plan.id === 'rookie' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                    plan.id === 'agent' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    plan.id === 'elite' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                  )}>
                    <Zap className="w-3 h-3 mr-1" />
                    {isEn ? plan.postsPerDayEn : plan.postsPerDay}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4 relative z-10">
                  {/* Features */}
                  <ul className="space-y-3">
                    {features.map((feature, fIdx) => (
                      <li
                        key={fIdx}
                        className={cn(
                          'flex items-start gap-2 text-sm',
                          !feature.included && 'text-muted-foreground/50'
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                            feature.included
                              ? feature.highlight
                                ? cn('text-white shadow-sm',
                                    plan.id === 'rookie' && 'bg-emerald-500',
                                    plan.id === 'agent' && 'bg-amber-500',
                                    plan.id === 'elite' && 'bg-purple-500',
                                  )
                                : 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                              : 'bg-muted text-muted-foreground/30'
                          )}
                        >
                          <Check className="w-3 h-3" />
                        </div>
                        <span className={cn(feature.highlight && 'font-medium')}>{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    className={cn(
                      'w-full h-12 font-semibold gap-2 transition-all duration-300 btn-shine',
                      plan.id === 'rookie' && !isCurrentPlan && 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02]',
                      plan.id === 'agent' && !isCurrentPlan && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02]',
                      plan.id === 'elite' && !isCurrentPlan && 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.02]',
                    )}
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan
                      ? isEn
                        ? 'Current Plan'
                        : 'แพ็คเกจปัจจุบัน'
                      : plan.price === 0
                        ? isEn
                          ? 'Get Started'
                          : 'เริ่มต้นใช้งาน'
                        : isEn
                          ? 'Contact Us — LINE'
                          : 'ติดต่อซื้อ — LINE'}
                    {!isCurrentPlan && <ArrowRight className="w-4 h-4" />}
                  </Button>
                </CardContent>
              </Card>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ / Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
        <Card className="card-glow overflow-hidden relative group">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" style={{ animation: 'shimmer 3s ease-in-out infinite' }} />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-accent" />
              {isEn ? 'Why choose GrandState?' : 'ทำไมต้อง GrandState?'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Clock, color: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400', title: isEn ? 'Save Time' : 'ประหยัดเวลา', desc: isEn ? 'Automate posting to multiple groups in minutes' : 'โพสต์หลายกลุ่มอัตโนมัติในไม่กี่นาที' },
                { icon: TrendingUp, color: 'bg-green-100 dark:bg-green-900/40', iconColor: 'text-green-600 dark:text-green-400', title: isEn ? 'Increase Sales' : 'เพิ่มยอดขาย', desc: isEn ? 'Reach more potential buyers with wider coverage' : 'เข้าถึงผู้ซื้อได้มากขึ้นด้วยการกระจายโพสต์' },
                { icon: Shield, color: 'bg-purple-100 dark:bg-purple-900/40', iconColor: 'text-purple-600 dark:text-purple-400', title: isEn ? 'Safe & Reliable' : 'ปลอดภัย & เสถียร', desc: isEn ? 'Built-in safety features to protect your account' : 'ระบบป้องกันบัญชีถูกแบนในตัว' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
                    <item.icon className={cn('w-5 h-5', item.iconColor)} />
                  </motion.div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Contact */}
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {isEn ? 'Have questions? Contact us via' : 'มีคำถาม? ติดต่อเราได้ที่'}{' '}
            <a
              href="https://line.me/ti/p/@897hrloe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE @grandstate
            </a>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
