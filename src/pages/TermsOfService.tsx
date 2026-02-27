
import { motion } from 'framer-motion';
import {
  Gavel,
  ArrowLeft,
  ScrollText,
  Shield,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Scale,
  UserCheck,
  Ban,
  Info,
  MessageCircle,
  Mail,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { GrandStateLogo } from '@/components/GrandStateLogo';
import { useLanguage } from '@/i18n/LanguageContext';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
});

interface SectionProps {
  icon: React.ElementType;
  number: string;
  title: string;
  children: React.ReactNode;
  delay: number;
  accent?: string;
}

function Section({ icon: Icon, number, title, children, delay, accent = 'text-accent' }: SectionProps) {
  return (
    <motion.div {...fadeUp(delay)} className="group">
      <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 md:p-8 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 card-hover-lift">
        <div className="absolute top-0 left-6 -translate-y-1/2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background border border-border text-xs font-bold text-muted-foreground">
            <Icon className={`w-3.5 h-3.5 ${accent}`} />
            ข้อ {number}
          </span>
        </div>
        <h3 className="text-lg font-bold mt-2 mb-4 flex items-center gap-2">
          <Icon className={`w-5 h-5 ${accent}`} />
          {title}
        </h3>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export default function TermsOfService() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEn = language === 'en';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-16">
        {/* Back Button */}
        <motion.div {...fadeUp(0)}>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-8 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            {isEn ? 'Back' : 'ย้อนกลับ'}
          </Button>
        </motion.div>

        {/* Hero Header */}
        <motion.div {...fadeUp(0.1)} className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-orange-500/10 border border-accent/20 mb-6">
            <Gavel className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {isEn ? 'Terms of Service' : 'ข้อตกลงและเงื่อนไขการใช้บริการ'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {isEn ? 'Terms of Service' : 'Terms of Service'} — Grand$tate
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
              <FileText className="w-3 h-3" />
              v2.0
            </span>
            <span className="text-xs text-muted-foreground">
              {isEn ? 'Effective: January 1, 2025' : 'มีผลบังคับใช้: 1 มกราคม 2568'}
            </span>
          </div>
        </motion.div>

        {/* Important Notice Banner */}
        <motion.div {...fadeUp(0.2)} className="mb-8">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 p-5 md:p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Info className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">{isEn ? 'Important Notice' : 'หมายเหตุสำคัญ'}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'Grand$tate is a marketing support tool designed to help real estate agents save time on social media posting. It is NOT a guarantee against platform restrictions. Users are responsible for complying with Facebook\'s Community Standards and Terms of Service at all times.'
                    : 'Grand$tate เป็นเครื่องมือช่วยเหลือด้านการตลาดที่ออกแบบมาเพื่อช่วยให้ตัวแทนอสังหาริมทรัพย์ประหยัดเวลาในการโพสต์บนสื่อสังคมออนไลน์ ระบบไม่ได้รับประกันว่าจะป้องกันการถูกจำกัดจากแพลตฟอร์มได้ 100% ผู้ใช้มีหน้าที่ปฏิบัติตามมาตรฐานชุมชนและข้อกำหนดของ Facebook ด้วยตนเอง'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sections Grid */}
        <div className="space-y-6">
          <Section icon={ScrollText} number="1" title={isEn ? 'General Agreement' : 'ข้อตกลงทั่วไป'} delay={0.25}>
            <p>
              {isEn
                ? 'By accessing and using Grand$tate, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, please discontinue use immediately.'
                : 'การเข้าใช้งาน Grand$tate หมายความว่าท่านได้อ่าน ทำความเข้าใจ และยอมรับข้อตกลงเหล่านี้ หากท่านไม่ยอมรับ โปรดหยุดการใช้งานทันที'}
            </p>
            <p>
              {isEn
                ? 'Grand$tate is a real estate marketing assistant tool that helps automate the process of posting property listings to Facebook Groups and Marketplace. It acts as a productivity aid — the user retains full responsibility for all content posted through the platform.'
                : 'Grand$tate เป็นเครื่องมือช่วยเหลือด้านการตลาดอสังหาริมทรัพย์ ที่ช่วยทำให้กระบวนการโพสต์ประกาศอสังหาฯ ไปยัง Facebook Groups และ Marketplace เป็นไปโดยอัตโนมัติ ทำหน้าที่เป็นตัวช่วยเพิ่มประสิทธิภาพ — ผู้ใช้เป็นผู้รับผิดชอบเนื้อหาทั้งหมดที่โพสต์ผ่านแพลตฟอร์ม'}
            </p>
          </Section>

          <Section icon={UserCheck} number="2" title={isEn ? 'License & Usage' : 'การอนุญาตให้ใช้สิทธิ์ (License)'} delay={0.3}>
            <p>{isEn ? 'We grant you a limited, non-exclusive, non-transferable license to use the software according to the selected package:' : 'เราอนุญาตให้ท่านใช้ซอฟต์แวร์ตามแพ็คเกจที่ท่านเลือก:'}</p>
            <ul className="space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Rookie (Free):</strong> {isEn ? 'For personal use with basic features' : 'สำหรับใช้งานส่วนตัวพร้อมฟีเจอร์พื้นฐาน'}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Top Agent:</strong> {isEn ? 'For real estate agents and small teams' : 'สำหรับตัวแทนอสังหาฯ และทีมขนาดเล็ก'}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Elite:</strong> {isEn ? 'For agencies and power users with full features' : 'สำหรับเอเจนซี่และผู้ใช้ระดับสูงพร้อมฟีเจอร์ครบครัน'}</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span>{isEn ? 'Reproduction, modification, or redistribution of the software without authorization is strictly prohibited.' : 'ห้ามทำซ้ำ ดัดแปลง หรือจำหน่ายจ่ายแจกซอฟต์แวร์โดยไม่ได้รับอนุญาตอย่างเด็ดขาด'}</span>
              </li>
            </ul>
          </Section>

          <Section icon={Scale} number="3" title={isEn ? 'User Responsibilities' : 'ความรับผิดชอบของผู้ใช้'} delay={0.35} accent="text-blue-500">
            <p>{isEn ? 'As a user of Grand$tate, you agree to:' : 'ในฐานะผู้ใช้งาน Grand$tate ท่านตกลงว่า:'}</p>
            <ul className="space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-500 text-xs font-bold">1</span>
                <span>{isEn ? 'Use the platform in compliance with Facebook\'s Terms of Service and Community Standards.' : 'ใช้แพลตฟอร์มตามข้อกำหนดการใช้งานและมาตรฐานชุมชนของ Facebook'}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-500 text-xs font-bold">2</span>
                <span>{isEn ? 'Ensure all posted content (photos, descriptions, prices) is truthful and not misleading.' : 'ตรวจสอบให้แน่ใจว่าเนื้อหาทั้งหมดที่โพสต์ (รูปภาพ รายละเอียด ราคา) เป็นความจริงและไม่ทำให้เข้าใจผิด'}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-500 text-xs font-bold">3</span>
                <span>{isEn ? 'Not use the platform for spam, fraud, or any activity that violates applicable laws.' : 'ไม่ใช้แพลตฟอร์มเพื่อส่งสแปม ฉ้อโกง หรือกิจกรรมใดๆ ที่ละเมิดกฎหมายที่บังคับใช้'}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-blue-500 text-xs font-bold">4</span>
                <span>{isEn ? 'Accept that posting frequency and behavior may be subject to Facebook\'s rate limits and policies.' : 'ยอมรับว่าความถี่และรูปแบบการโพสต์อาจอยู่ภายใต้ข้อจำกัดและนโยบายของ Facebook'}</span>
              </li>
            </ul>
          </Section>

          <Section icon={CreditCard} number="4" title={isEn ? 'Payment & Refund' : 'การชำระเงินและการขอคืนเงิน'} delay={0.4}>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{isEn ? 'Payments are processed securely through authorized payment providers.' : 'การชำระเงินดำเนินการอย่างปลอดภัยผ่านผู้ให้บริการที่ได้รับอนุญาต'}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{isEn ? '7-day money-back guarantee if the software does not function as described — contact us via LINE.' : 'รับประกันคืนเงินภายใน 7 วันหากซอฟต์แวร์ไม่ทำงานตามที่ระบุ — ติดต่อเราผ่าน LINE'}</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span>{isEn ? 'Refunds are NOT available for account restrictions imposed by Facebook, as this is outside our control.' : 'ไม่สามารถขอคืนเงินได้ในกรณีที่บัญชีถูกจำกัดจาก Facebook เนื่องจากเป็นสิ่งที่อยู่นอกเหนือการควบคุมของเรา'}</span>
              </li>
            </ul>
          </Section>

          <Section icon={AlertTriangle} number="5" title={isEn ? 'Limitation of Liability' : 'ข้อจำกัดความรับผิด'} delay={0.45} accent="text-amber-500">
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="font-medium text-foreground mb-2">
                {isEn ? 'Please understand the following:' : 'โปรดทำความเข้าใจดังต่อไปนี้:'}
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{isEn
                    ? 'Grand$tate is a TOOL designed to assist with posting — it does not guarantee any specific outcomes on Facebook.'
                    : 'Grand$tate เป็นเครื่องมือที่ออกแบบมาเพื่อช่วยเหลือในการโพสต์ — ไม่ได้รับประกันผลลัพธ์ใดๆ บน Facebook'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{isEn
                    ? 'We are NOT responsible for any account restrictions, bans, or content removals imposed by Facebook or other third-party platforms.'
                    : 'เราไม่รับผิดชอบต่อการจำกัดบัญชี การแบน หรือการลบเนื้อหาที่กำหนดโดย Facebook หรือแพลตฟอร์มของบุคคลที่สาม'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{isEn
                    ? 'Users posting excessively or in violation of group rules may face consequences from Facebook — Grand$tate provides tools, but the user decides how to use them.'
                    : 'ผู้ใช้ที่โพสต์มากเกินไปหรือละเมิดกฎกลุ่มอาจได้รับผลกระทบจาก Facebook — Grand$tate ให้เครื่องมือ แต่ผู้ใช้เป็นผู้ตัดสินใจว่าจะใช้อย่างไร'}</span>
                </li>
              </ul>
            </div>
          </Section>

          <Section icon={Ban} number="6" title={isEn ? 'Prohibited Uses' : 'การใช้งานที่ห้าม'} delay={0.5} accent="text-red-500">
            <p>{isEn ? 'The following uses are strictly prohibited:' : 'การใช้งานต่อไปนี้ถือเป็นสิ่งต้องห้ามอย่างเด็ดขาด:'}</p>
            <ul className="space-y-2 mt-2">
              {[
                isEn ? 'Using the platform to post fraudulent, misleading, or illegal content' : 'ใช้แพลตฟอร์มเพื่อโพสต์เนื้อหาหลอกลวง ทำให้เข้าใจผิด หรือผิดกฎหมาย',
                isEn ? 'Attempting to circumvent Facebook\'s security measures or terms' : 'พยายามหลีกเลี่ยงมาตรการรักษาความปลอดภัยหรือข้อกำหนดของ Facebook',
                isEn ? 'Sharing your account or license key with unauthorized third parties' : 'แชร์บัญชีหรือ License Key ของท่านกับบุคคลที่สามที่ไม่ได้รับอนุญาต',
                isEn ? 'Using the platform for any activity that violates Thai law or international regulations' : 'ใช้แพลตฟอร์มเพื่อกิจกรรมใดๆ ที่ละเมิดกฎหมายไทยหรือกฎระเบียบสากล',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={RefreshCw} number="7" title={isEn ? 'Changes to Terms' : 'การเปลี่ยนแปลงเงื่อนไข'} delay={0.55}>
            <p>
              {isEn
                ? 'We reserve the right to update these Terms of Service at any time. Significant changes will be communicated via email or in-app notification. Continued use of the platform after changes constitutes acceptance of the new terms.'
                : 'เราสงวนสิทธิ์ในการปรับปรุงข้อตกลงการใช้บริการเหล่านี้ได้ตลอดเวลา การเปลี่ยนแปลงที่สำคัญจะแจ้งให้ทราบผ่านอีเมลหรือการแจ้งเตือนในแอป การใช้งานแพลตฟอร์มต่อหลังจากมีการเปลี่ยนแปลงถือว่าท่านยอมรับข้อกำหนดใหม่'}
            </p>
          </Section>
        </div>

        {/* Contact Footer */}
        <motion.div {...fadeUp(0.6)} className="mt-12 mb-8">
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 md:p-8 text-center">
            <GrandStateLogo className="w-10 h-10 mx-auto mb-4 text-accent" />
            <h3 className="font-bold text-lg mb-2">{isEn ? 'Questions?' : 'มีคำถาม?'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isEn ? 'If you have questions about these terms, reach out anytime.' : 'หากมีคำถามเกี่ยวกับข้อตกลงเหล่านี้ ติดต่อเราได้ตลอดเวลา'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="mailto:support@grandstate.co" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors">
                <Mail className="w-4 h-4" />
                support@grandstate.co
              </a>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
                <MessageCircle className="w-4 h-4" />
                LINE: @grandstate
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
