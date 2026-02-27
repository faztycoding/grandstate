import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { GrandStateLogo } from '@/components/GrandStateLogo';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Help() {
  const { language } = useLanguage();
  const isEn = language === 'en';

  return (
    <DashboardLayout 
      title={isEn ? 'Help Center' : 'ศูนย์ช่วยเหลือ'} 
      subtitle={isEn ? 'Everything you need to get the most out of GrandState' : 'ทุกสิ่งที่คุณต้องรู้เพื่อใช้งาน GrandState อย่างเต็มประสิทธิภาพ'}
    >
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Quick Start — 4 Steps */}
        <Card className="card-elevated card-hover-lift overflow-hidden">
          <div className="bg-gradient-to-r from-accent/10 via-orange-500/5 to-transparent p-6 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-accent-foreground" />
              </div>
              {isEn ? 'Quick Start Guide' : 'เริ่มต้นใช้งาน'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isEn ? '4 simple steps to your first automated post' : '4 ขั้นตอนง่ายๆ สู่โพสต์อัตโนมัติแรกของคุณ'}
            </p>
          </div>
          <CardContent className="pt-2 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { n: 1, icon: Building2, title: isEn ? 'Add Property' : 'เพิ่มสินทรัพย์', desc: isEn ? 'Fill in details, upload photos, set price & location' : 'กรอกข้อมูล อัพรูป ตั้งราคา และที่ตั้ง', link: '/properties', color: 'from-blue-500 to-cyan-500' },
                { n: 2, icon: Users, title: isEn ? 'Add Groups' : 'เพิ่มกลุ่ม', desc: isEn ? 'Paste Facebook group URLs — add as many as you need' : 'วาง URL กลุ่ม Facebook — เพิ่มได้ไม่จำกัด', link: '/groups', color: 'from-green-500 to-emerald-500' },
                { n: 3, icon: Facebook, title: isEn ? 'Connect Facebook' : 'เชื่อมต่อ Facebook', desc: isEn ? 'Log in once — the system remembers your session' : 'Login ครั้งเดียว ระบบจำ session อัตโนมัติ', link: '/settings', color: 'from-[#1877F2] to-blue-600' },
                { n: 4, icon: Sparkles, title: isEn ? 'Start Posting' : 'เริ่มโพสต์', desc: isEn ? 'Select property & groups, then let automation handle the rest' : 'เลือกสินทรัพย์ + กลุ่ม แล้วปล่อยระบบทำงาน', link: '/automation', color: 'from-amber-500 to-orange-500' },
              ].map((step, i) => (
                <Link key={step.n} to={step.link}>
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="group relative p-4 rounded-xl border bg-card hover:shadow-md transition-all h-full"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center mb-3`}>
                      <step.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-muted-foreground">STEP {step.n}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent absolute top-4 right-4 transition-colors" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Posting Modes */}
        <Card className="card-elevated card-hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              {isEn ? 'Posting Modes' : 'โหมดการโพสต์'}
            </CardTitle>
            <CardDescription>
              {isEn ? 'Choose the approach that fits your marketing strategy' : 'เลือกวิธีที่ตอบโจทย์กลยุทธ์การตลาดของคุณ'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border-2 border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-950/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">🏪 Marketplace</Badge>
                </div>
                <p className="text-sm font-semibold">{isEn ? 'Marketplace Mode' : 'โหมด Marketplace'}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'Creates a listing on Facebook Marketplace and automatically shares to selected groups. Ideal for maximizing exposure to both Marketplace browsers and group members.'
                    : 'สร้างประกาศบน Facebook Marketplace และแชร์ไปยังกลุ่มที่เลือกอัตโนมัติ เหมาะกับการเข้าถึงทั้งคนเข้าดู Marketplace และสมาชิกในกลุ่ม'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(isEn ? ['Auto listing', 'Group sharing', 'Photo gallery'] : ['สร้างประกาศอัตโนมัติ', 'แชร์ไปกลุ่ม', 'แกลเลอรี่รูป']).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-xl border-2 border-green-200/50 dark:border-green-800/30 bg-green-50/30 dark:bg-green-950/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">👥 Group Post</Badge>
                </div>
                <p className="text-sm font-semibold">{isEn ? 'Group Post Mode' : 'โหมด Group Post'}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'Posts directly to each Facebook group with full automation — including buy/sell groups with form auto-fill (property type, price, location).'
                    : 'โพสต์ตรงไปยังแต่ละกลุ่มพร้อม automation เต็มรูปแบบ — รองรับกลุ่มซื้อขาย กรอกฟอร์มอัตโนมัติ (ประเภท, ราคา, ที่ตั้ง)'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(isEn ? ['Direct post', 'Buy/sell forms', 'Custom caption'] : ['โพสต์ตรง', 'ฟอร์มซื้อขาย', 'Caption กำหนดเอง']).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Overview */}
        <Card className="card-elevated card-hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              {isEn ? 'Features' : 'ฟีเจอร์ของระบบ'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Sparkles, title: isEn ? 'AI Caption' : 'AI Caption', desc: isEn ? 'Generate unique, engaging captions powered by Claude AI — tailored for each post' : 'สร้างแคปชั่นที่ไม่ซ้ำและน่าสนใจด้วย Claude AI — ปรับให้เหมาะกับแต่ละโพสต์', color: 'text-purple-500' },
                { icon: Image, title: isEn ? 'Smart Photo Upload' : 'อัพรูปอัจฉริยะ', desc: isEn ? 'Automatically uploads property photos with each post' : 'อัพโหลดรูปสินทรัพย์อัตโนมัติพร้อมทุกโพสต์', color: 'text-pink-500' },
                { icon: ShieldCheck, title: isEn ? 'Health Check' : 'Health Check', desc: isEn ? 'Monitor account safety score — get recommendations to post safely' : 'ตรวจสอบคะแนนความปลอดภัย — รับคำแนะนำเพื่อโพสต์อย่างปลอดภัย', color: 'text-green-500' },
                { icon: BarChart3, title: isEn ? 'Analytics' : 'วิเคราะห์ผล', desc: isEn ? 'Track posting history, success rates, and group performance' : 'ติดตามประวัติโพสต์ อัตราสำเร็จ และประสิทธิภาพกลุ่ม', color: 'text-blue-500' },
                { icon: Calendar, title: isEn ? 'Schedule Posts' : 'ตั้งเวลาโพสต์', desc: isEn ? 'Schedule posts for optimal times — the system runs automatically' : 'ตั้งเวลาโพสต์ล่วงหน้า — ระบบทำงานอัตโนมัติตามเวลาที่กำหนด', color: 'text-amber-500' },
                { icon: Palette, title: isEn ? 'Customizable Theme' : 'ปรับธีมได้', desc: isEn ? 'Multiple color palettes with dark/light mode to match your style' : 'หลายโทนสีพร้อมโหมดมืด/สว่าง ปรับตามสไตล์คุณ', color: 'text-indigo-500' },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                >
                  <f.icon className={`w-5 h-5 ${f.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pro Tips */}
        <Card className="card-elevated card-hover-lift bg-gradient-to-br from-yellow-50/50 to-amber-50/30 dark:from-yellow-950/10 dark:to-amber-950/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              {isEn ? 'Pro Tips for Best Results' : 'เคล็ดลับเพื่อผลลัพธ์ที่ดีที่สุด'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Clock, title: isEn ? 'Post at Peak Hours' : 'โพสต์ช่วงเวลาทอง', desc: isEn ? '7-9 AM and 6-9 PM typically get the highest reach and engagement' : '7-9 โมงเช้า และ 6-9 โมงเย็น เป็นช่วงที่ได้ reach และ engagement สูงสุด' },
                { icon: MessageSquare, title: isEn ? 'Great Captions Matter' : 'แคปชั่นดี = ยอดขาย', desc: isEn ? 'Include price, location & contact clearly. Use AI Caption for professional results.' : 'ใส่ราคา ที่ตั้ง ข้อมูลติดต่อชัดเจน ใช้ AI Caption ช่วยได้ผลมืออาชีพ' },
                { icon: Image, title: isEn ? 'Quality Photos First' : 'รูปคุณภาพมาก่อน', desc: isEn ? 'Use bright, high-resolution photos. The cover image is what buyers see first.' : 'ใช้รูปสว่าง ความละเอียดสูง รูปแรกคือสิ่งที่ผู้ซื้อเห็นก่อน' },
                { icon: TrendingUp, title: isEn ? 'Use Multiple Captions' : 'ใช้แคปชั่นหลายแบบ', desc: isEn ? 'Vary your captions across groups for better visibility and engagement' : 'ใช้แคปชั่นต่างกันในแต่ละกลุ่ม ช่วยเพิ่มการมองเห็นและ engagement' },
                { icon: ShieldCheck, title: isEn ? 'Monitor Health Score' : 'เช็คคะแนนสุขภาพ', desc: isEn ? 'Keep your Health Check score green for long-term account safety' : 'รักษาคะแนน Health Check ให้อยู่ในโซนเขียวเพื่อความปลอดภัยระยะยาว' },
                { icon: Calendar, title: isEn ? 'Schedule Ahead' : 'ตั้งเวลาล่วงหน้า', desc: isEn ? 'Use scheduling for consistent daily posting without manual effort' : 'ตั้งเวลาโพสต์ล่วงหน้าเพื่อความสม่ำเสมอโดยไม่ต้องกดเอง' },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/60 dark:bg-card/50 border border-yellow-200/30 dark:border-yellow-800/20">
                  <tip.icon className="w-4.5 h-4.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="card-elevated card-hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              {isEn ? 'Frequently Asked Questions' : 'คำถามที่พบบ่อย'}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Terms & Privacy — compact */}
        <Card className="card-elevated card-hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="w-5 h-5 text-muted-foreground" />
              {isEn ? 'Terms & Privacy' : 'ข้อกำหนดและความเป็นส่วนตัว'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="disclaimer">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-500" />
                    {isEn ? 'Disclaimer' : 'ข้อจำกัดความรับผิดชอบ'}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'GrandState is a posting assistance tool. The developer is not responsible if your Facebook account is restricted, suspended, or banned. The app provides Health Check monitoring and recommendations, but the user assumes all responsibility for posting behavior and account safety.'
                    : 'GrandState เป็นเครื่องมือช่วยโพสต์ ผู้พัฒนาไม่รับผิดชอบหากบัญชี Facebook ถูกจำกัด ระงับ หรือแบน แอปมีระบบ Health Check คอยตรวจสอบและแนะนำ แต่ผู้ใช้รับผิดชอบพฤติกรรมการโพสต์และความปลอดภัยของบัญชีตนเอง'}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="terms">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    {isEn ? 'Terms of Use' : 'ข้อกำหนดการใช้งาน'}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <li>• {isEn ? 'Provided "as is" without warranty.' : 'ให้บริการ "ตามสภาพ" โดยไม่มีการรับประกัน'}</li>
                    <li>• {isEn ? 'Users must comply with Facebook\'s Terms of Service.' : 'ผู้ใช้ต้องปฏิบัติตามข้อกำหนดของ Facebook'}</li>
                    <li>• {isEn ? 'Users are responsible for content and posting frequency.' : 'ผู้ใช้รับผิดชอบเนื้อหาและความถี่ในการโพสต์'}</li>
                    <li>• {isEn ? 'Do not use for spam, scam, or illegal activity.' : 'ห้ามใช้เพื่อสแปม หลอกลวง หรือกิจกรรมผิดกฎหมาย'}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="privacy">
                <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-500" />
                    {isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <li>• {isEn ? 'All data stored locally on your device only.' : 'ข้อมูลทั้งหมดจัดเก็บในเครื่องของคุณเท่านั้น'}</li>
                    <li>• {isEn ? 'Facebook session managed locally — your password is never stored.' : 'Session Facebook จัดการภายในเครื่อง — ไม่เก็บรหัสผ่าน'}</li>
                    <li>• {isEn ? 'Claude API Key sent only to Anthropic\'s API.' : 'Claude API Key ส่งตรงไปยัง Anthropic เท่านั้น'}</li>
                    <li>• {isEn ? 'Export or delete your data anytime from Settings.' : 'ส่งออกหรือลบข้อมูลได้ตลอดเวลาจากหน้าตั้งค่า'}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: isEn ? 'Automation' : 'Automation', link: '/automation', icon: Zap },
            { label: isEn ? 'Properties' : 'สินทรัพย์', link: '/properties', icon: Building2 },
            { label: isEn ? 'Analytics' : 'วิเคราะห์', link: '/analytics', icon: BarChart3 },
            { label: isEn ? 'Settings' : 'ตั้งค่า', link: '/settings', icon: Palette },
          ].map((item) => (
            <Link key={item.link} to={item.link}>
              <Button variant="outline" className="w-full justify-start gap-2 h-11">
                <item.icon className="w-4 h-4 text-accent" />
                {item.label}
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
              </Button>
            </Link>
          ))}
        </div>

        {/* Version */}
        <div className="text-center py-3 flex flex-col items-center gap-1">
          <GrandStateLogo className="w-7 h-7" />
          <p className="text-xs font-bold bg-gradient-to-r from-accent via-amber-400 to-accent bg-clip-text text-transparent">
            Grand<span className="text-amber-400">$</span>tate
          </p>
          <p className="text-[9px] text-muted-foreground tracking-widest">v2.0</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
