
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Database,
  Eye,
  Lock,
  Trash2,
  Cookie,
  Globe,
  UserCheck,
  ServerCrash,
  FileText,
  CheckCircle2,
  XCircle,
  Info,
  MessageCircle,
  Mail,
  ShieldCheck,
  RefreshCw,
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

function Section({ icon: Icon, number, title, children, delay, accent = 'text-emerald-500' }: SectionProps) {
  return (
    <motion.div {...fadeUp(delay)} className="group">
      <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 md:p-8 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 card-hover-lift">
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

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEn = language === 'en';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl" />
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 mb-6">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {isEn ? 'Privacy Policy' : 'Privacy Policy'} — Grand$tate
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
              <FileText className="w-3 h-3" />
              v2.0
            </span>
            <span className="text-xs text-muted-foreground">
              {isEn ? 'Effective: January 1, 2025' : 'มีผลบังคับใช้: 1 มกราคม 2568'}
            </span>
          </div>
        </motion.div>

        {/* Trust Banner */}
        <motion.div {...fadeUp(0.2)} className="mb-8">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 p-5 md:p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">{isEn ? 'Your Data is Safe with Us' : 'ข้อมูลของคุณปลอดภัยกับเรา'}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'Grand$tate is committed to protecting your privacy. We collect only the minimum data necessary to provide our services, and we NEVER sell your personal information to third parties.'
                    : 'Grand$tate มุ่งมั่นในการปกป้องความเป็นส่วนตัวของท่าน เราเก็บรวบรวมข้อมูลเท่าที่จำเป็นต่อการให้บริการเท่านั้น และเราไม่ขายข้อมูลส่วนตัวของท่านให้บุคคลที่สามเด็ดขาด'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          <Section icon={Database} number="1" title={isEn ? 'Data We Collect' : 'ข้อมูลที่เราเก็บรวบรวม'} delay={0.25}>
            <p>{isEn ? 'We collect only the minimum data required to operate our platform:' : 'เราเก็บรวบรวมข้อมูลเท่าที่จำเป็นเพื่อดำเนินการแพลตฟอร์มของเรา:'}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {[
                {
                  icon: UserCheck,
                  title: isEn ? 'Personal Data' : 'ข้อมูลส่วนตัว',
                  items: isEn
                    ? ['Name', 'Email address', 'LINE ID (optional)']
                    : ['ชื่อ', 'อีเมล', 'LINE ID (ถ้ามี)'],
                  color: 'text-blue-500',
                  bg: 'bg-blue-500/10',
                },
                {
                  icon: Eye,
                  title: isEn ? 'Usage Data' : 'ข้อมูลการใช้งาน',
                  items: isEn
                    ? ['Login history', 'Feature usage stats', 'Posting analytics']
                    : ['ประวัติการเข้าสู่ระบบ', 'สถิติการใช้งานฟีเจอร์', 'สถิติการโพสต์'],
                  color: 'text-purple-500',
                  bg: 'bg-purple-500/10',
                },
                {
                  icon: Globe,
                  title: isEn ? 'Device Data' : 'ข้อมูลอุปกรณ์',
                  items: isEn
                    ? ['IP address', 'Browser type', 'Session info']
                    : ['IP Address', 'ประเภทเบราว์เซอร์', 'ข้อมูลเซสชั่น'],
                  color: 'text-orange-500',
                  bg: 'bg-orange-500/10',
                },
              ].map((cat, i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-background/50 p-4">
                  <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center mb-2`}>
                    <cat.icon className={`w-4 h-4 ${cat.color}`} />
                  </div>
                  <p className="font-semibold text-xs text-foreground mb-1.5">{cat.title}</p>
                  <ul className="space-y-1">
                    {cat.items.map((item, j) => (
                      <li key={j} className="text-xs flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Eye} number="2" title={isEn ? 'How We Use Your Data' : 'การใช้ข้อมูลของท่าน'} delay={0.3} accent="text-blue-500">
            <p>{isEn ? 'Your data is used solely for:' : 'ข้อมูลของท่านถูกใช้เพื่อ:'}</p>
            <ul className="space-y-2 mt-2">
              {[
                isEn ? 'Identity verification and license management' : 'ยืนยันตัวตนและจัดการ License',
                isEn ? 'Improving software performance and user experience' : 'ปรับปรุงประสิทธิภาพซอฟต์แวร์และประสบการณ์ผู้ใช้',
                isEn ? 'Sending important service updates and notifications' : 'ส่งข่าวสารอัปเดตและการแจ้งเตือนที่สำคัญ',
                isEn ? 'Generating anonymized analytics to improve our platform' : 'สร้างสถิติแบบไม่ระบุตัวตนเพื่อปรับปรุงแพลตฟอร์ม',
                isEn ? 'Providing customer support' : 'ให้บริการสนับสนุนลูกค้า',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={Lock} number="3" title={isEn ? 'Data Sharing & Disclosure' : 'การเปิดเผยข้อมูล'} delay={0.35} accent="text-red-500">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 mb-3">
              <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                {isEn ? 'We NEVER sell your personal data.' : 'เราไม่ขายข้อมูลส่วนตัวของท่านเด็ดขาด'}
              </p>
            </div>
            <p>{isEn ? 'Limited data may be shared only in these cases:' : 'ข้อมูลที่จำกัดอาจถูกแชร์เฉพาะในกรณีต่อไปนี้:'}</p>
            <ul className="space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>{isEn ? 'Payment processors — only transaction data necessary to complete purchases' : 'ผู้ให้บริการชำระเงิน — เฉพาะข้อมูลธุรกรรมที่จำเป็นในการดำเนินการซื้อ'}</span>
              </li>
              <li className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>{isEn ? 'Legal compliance — when required by Thai law or court orders' : 'การปฏิบัติตามกฎหมาย — เมื่อกฎหมายไทยหรือคำสั่งศาลกำหนด'}</span>
              </li>
            </ul>
          </Section>

          <Section icon={ShieldCheck} number="4" title={isEn ? 'Data Security' : 'ความปลอดภัยของข้อมูล'} delay={0.4}>
            <p>{isEn ? 'We implement industry-standard security measures to protect your data:' : 'เราใช้มาตรการรักษาความปลอดภัยตามมาตรฐานสากลเพื่อปกป้องข้อมูลของท่าน:'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {[
                { icon: Lock, label: isEn ? 'SSL/TLS Encryption' : 'เข้ารหัส SSL/TLS', desc: isEn ? 'All data in transit is encrypted' : 'ข้อมูลระหว่างทางเข้ารหัสทั้งหมด' },
                { icon: Database, label: isEn ? 'Secure Database' : 'ฐานข้อมูลปลอดภัย', desc: isEn ? 'Row-level security policies' : 'นโยบายความปลอดภัยระดับแถว (RLS)' },
                { icon: UserCheck, label: isEn ? 'Per-User Isolation' : 'แยกข้อมูลต่อผู้ใช้', desc: isEn ? 'Your data is isolated from other users' : 'ข้อมูลของท่านแยกจากผู้ใช้อื่น' },
                { icon: ServerCrash, label: isEn ? 'No Data Mining' : 'ไม่ขุดเหมืองข้อมูล', desc: isEn ? 'We don\'t analyze your content for ads' : 'เราไม่วิเคราะห์เนื้อหาเพื่อโฆษณา' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-background/50">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Cookie} number="5" title={isEn ? 'Cookies & Local Storage' : 'คุกกี้และ Local Storage'} delay={0.45} accent="text-orange-500">
            <p>
              {isEn
                ? 'We use browser local storage and session cookies to maintain your login state, remember your preferences, and ensure smooth operation of the platform. We do NOT use tracking cookies for advertising purposes.'
                : 'เราใช้ Local Storage ของเบราว์เซอร์และ Session Cookie เพื่อรักษาสถานะการเข้าสู่ระบบ จดจำการตั้งค่าของท่าน และให้แพลตฟอร์มทำงานได้อย่างราบรื่น เราไม่ใช้คุกกี้ติดตามเพื่อวัตถุประสงค์ทางโฆษณา'}
            </p>
          </Section>

          <Section icon={Trash2} number="6" title={isEn ? 'Data Deletion & Your Rights' : 'การลบข้อมูลและสิทธิ์ของท่าน'} delay={0.5} accent="text-purple-500">
            <p>{isEn ? 'You have the following rights regarding your personal data:' : 'ท่านมีสิทธิ์ดังต่อไปนี้เกี่ยวกับข้อมูลส่วนตัวของท่าน:'}</p>
            <ul className="space-y-2 mt-2">
              {[
                isEn ? 'Request access to your personal data at any time' : 'ขอเข้าถึงข้อมูลส่วนตัวของท่านได้ตลอดเวลา',
                isEn ? 'Request correction of inaccurate data' : 'ขอแก้ไขข้อมูลที่ไม่ถูกต้อง',
                isEn ? 'Request complete deletion of your account and all associated data' : 'ขอลบบัญชีและข้อมูลที่เกี่ยวข้องทั้งหมดของท่าน',
                isEn ? 'Withdraw consent for data processing (may affect service availability)' : 'ถอนความยินยอมในการประมวลผลข้อมูล (อาจส่งผลต่อการให้บริการ)',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              {isEn
                ? 'To exercise any of these rights, contact us at support@grandstate.co or via LINE @grandstate. We will respond within 30 days.'
                : 'หากต้องการใช้สิทธิ์เหล่านี้ ติดต่อเราได้ที่ support@grandstate.co หรือผ่าน LINE @grandstate เราจะตอบกลับภายใน 30 วัน'}
            </p>
          </Section>

          <Section icon={RefreshCw} number="7" title={isEn ? 'Policy Updates' : 'การเปลี่ยนแปลงนโยบาย'} delay={0.55}>
            <p>
              {isEn
                ? 'We may update this Privacy Policy from time to time. When we make significant changes, we will notify you via email or in-app notification. Continued use of Grand$tate after changes constitutes acceptance of the updated policy.'
                : 'เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว เมื่อมีการเปลี่ยนแปลงที่สำคัญ เราจะแจ้งให้ท่านทราบผ่านอีเมลหรือการแจ้งเตือนในแอป การใช้งาน Grand$tate ต่อหลังจากมีการเปลี่ยนแปลงถือว่าท่านยอมรับนโยบายที่อัปเดตแล้ว'}
            </p>
          </Section>
        </div>

        {/* Contact Footer */}
        <motion.div {...fadeUp(0.6)} className="mt-12 mb-8">
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 md:p-8 text-center">
            <GrandStateLogo className="w-10 h-10 mx-auto mb-4 text-emerald-500" />
            <h3 className="font-bold text-lg mb-2">{isEn ? 'Privacy Questions?' : 'มีคำถามเกี่ยวกับความเป็นส่วนตัว?'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isEn ? 'We take your privacy seriously. Contact us anytime.' : 'เราให้ความสำคัญกับความเป็นส่วนตัวของท่านอย่างจริงจัง ติดต่อเราได้ตลอดเวลา'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="mailto:support@grandstate.co" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors">
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
