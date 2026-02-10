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
import { useState } from 'react';
import { getUserPackage } from '@/hooks/usePackageLimits';
import { toast } from 'sonner';

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
    postsPerDay: '20 โพสต์/วัน',
    postsPerDayEn: '20 posts/day',
    icon: Rocket,
    color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-teal-500',
    features: [
      { text: '20 โพสต์ต่อวัน', included: true },
      { text: 'เพิ่มสินทรัพย์ได้ 10 รายการ', included: true },
      { text: 'เพิ่มกลุ่มได้ 20 กลุ่ม', included: true },
      { text: 'รองรับ 2 ภาษา', included: true },
      { text: 'หลายบัญชี Facebook', included: false },
      { text: 'ตั้งเวลาโพสต์อัตโนมัติ', included: false },
      { text: 'Analytics & Reports', included: false },
      { text: 'Priority Support', included: false },
    ],
    featuresEn: [
      { text: '20 posts per day', included: true },
      { text: 'Up to 10 properties', included: true },
      { text: 'Up to 20 groups', included: true },
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
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
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

    // Paid plans - go to checkout
    setSelectedPlan(planId);
    window.location.href = `/checkout?package=${planId}`;
  };

  return (
    <DashboardLayout
      title={isEn ? 'Pricing Plans' : 'แพ็คเกจราคา'}
      subtitle={isEn ? 'Choose the plan that fits your needs' : 'เลือกแพ็คเกจที่เหมาะกับคุณ'}
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent">
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
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const features = isEn ? plan.featuresEn : plan.features;
            const isCurrentPlan = plan.id === currentPlan;

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative overflow-hidden transition-all duration-300 hover:shadow-xl',
                  plan.popular && 'border-2 border-accent shadow-lg scale-[1.02]',
                  isCurrentPlan && 'ring-2 ring-green-500'
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                      {isEn ? 'POPULAR' : 'ยอดนิยม'}
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0">
                    <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
                      {isEn ? 'CURRENT' : 'ปัจจุบัน'}
                    </div>
                  </div>
                )}

                {/* Gradient Header */}
                <div className={cn('h-2 bg-gradient-to-r', plan.gradient)} />

                <CardHeader className="text-center pb-2">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4',
                      plan.gradient
                    )}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  <CardTitle className="text-2xl">{isEn ? plan.nameEn : plan.name}</CardTitle>
                  <CardDescription>{isEn ? plan.descriptionEn : plan.description}</CardDescription>

                  {/* Price */}
                  <div className="pt-4">
                    {plan.price === 0 ? (
                      <div className="text-4xl font-bold text-green-600">
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
                  <Badge variant="secondary" className="mt-3">
                    <Zap className="w-3 h-3 mr-1" />
                    {isEn ? plan.postsPerDayEn : plan.postsPerDay}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features */}
                  <ul className="space-y-3">
                    {features.map((feature, index) => (
                      <li
                        key={index}
                        className={cn(
                          'flex items-start gap-2 text-sm',
                          !feature.included && 'text-muted-foreground'
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                            feature.included
                              ? feature.highlight
                                ? 'bg-accent text-white'
                                : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
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
                      'w-full h-12 font-semibold',
                      plan.popular
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                        : plan.id === 'elite'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                          : ''
                    )}
                    variant={plan.popular || plan.id === 'elite' ? 'default' : 'outline'}
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
                          ? 'Upgrade Now'
                          : 'อัพเกรดเลย'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ / Benefits */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-accent" />
              {isEn ? 'Why choose Grand$tate?' : 'ทำไมต้อง Grand$tate?'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">
                    {isEn ? 'Save Time' : 'ประหยัดเวลา'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isEn
                      ? 'Automate posting to multiple groups in minutes'
                      : 'โพสต์หลายกลุ่มอัตโนมัติในไม่กี่นาที'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">
                    {isEn ? 'Increase Sales' : 'เพิ่มยอดขาย'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isEn
                      ? 'Reach more potential buyers with wider coverage'
                      : 'เข้าถึงผู้ซื้อได้มากขึ้นด้วยการกระจายโพสต์'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">
                    {isEn ? 'Safe & Reliable' : 'ปลอดภัย & เสถียร'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isEn
                      ? 'Built-in safety features to protect your account'
                      : 'ระบบป้องกันบัญชีถูกแบนในตัว'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
              LINE @897hrloe
            </a>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
