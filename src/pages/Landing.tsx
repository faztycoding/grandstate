import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: Building2,
    title: 'จัดการทรัพย์สิน',
    titleEn: 'Property Management',
    description: 'เพิ่มข้อมูล ราคา รูปภาพ สิ่งอำนวยความสะดวก ครบจบในที่เดียว ข้อมูล Sync ข้ามอุปกรณ์ผ่าน Cloud',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Sparkles,
    title: 'AI สร้างแคปชั่น',
    titleEn: 'AI Caption Generator',
    description: 'Claude AI สร้างแคปชั่นภาษาไทยหลากหลายสไตล์ ไม่ซ้ำกัน เหมือนพิมพ์เอง ไม่โดนแบน',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: Users,
    title: 'จัดการกลุ่ม Facebook',
    titleEn: 'Group Management',
    description: 'เพิ่มกลุ่มด้วย URL ดึงข้อมูลอัตโนมัติ แบ่ง Active/Inactive จัดการกลุ่มได้สูงสุด 750 กลุ่ม',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Zap,
    title: 'โพสต์อัตโนมัติ',
    titleEn: 'Auto Posting',
    description: 'โพสต์ลงกลุ่ม Facebook + Marketplace อัตโนมัติ มี delay แบบมนุษย์ ป้องกันตรวจจับ',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Clock,
    title: 'ตั้งเวลาโพสต์',
    titleEn: 'Smart Scheduling',
    description: 'ตั้งเวลาล่วงหน้า ระบบโพสต์ให้อัตโนมัติตามเวลาที่กำหนด ไม่ต้องเฝ้าหน้าจอ',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: Store,
    title: 'Marketplace',
    titleEn: 'Facebook Marketplace',
    description: 'ลงประกาศ Marketplace พร้อมเลือกกลุ่มอัตโนมัติ ครอบคลุมผู้ซื้อมากขึ้น 10 เท่า',
    gradient: 'from-indigo-500 to-blue-500',
  },
];

const stats = [
  { number: '750+', label: 'โพสต์ / วัน', sublabel: 'แพ็กเกจ Elite' },
  { number: '10x', label: 'ประหยัดเวลา', sublabel: 'เทียบกับโพสต์มือ' },
  { number: '24/7', label: 'ทำงานอัตโนมัติ', sublabel: 'ตั้งเวลาได้' },
  { number: '100%', label: 'ข้อมูลแยก', sublabel: 'ปลอดภัยต่อ user' },
];

const packages = [
  {
    name: 'Rookie',
    icon: Rocket,
    price: 'ฟรี',
    period: '',
    color: 'from-emerald-500 to-teal-500',
    features: ['10 โพสต์/วัน', '10 กลุ่ม', '5 ทรัพย์สิน', 'โพสต์กลุ่ม'],
  },
  {
    name: 'Top Agent',
    icon: Star,
    price: '990',
    period: '/ เดือน',
    color: 'from-amber-500 to-orange-500',
    popular: true,
    features: ['300 โพสต์/วัน', '300 กลุ่ม', 'ไม่จำกัดทรัพย์สิน', 'กลุ่ม + Marketplace', 'AI แคปชั่น', 'ตั้งเวลาโพสต์'],
  },
  {
    name: 'Elite',
    icon: Crown,
    price: '1,990',
    period: '/ เดือน',
    color: 'from-purple-500 to-pink-500',
    features: ['750 โพสต์/วัน', '750 กลุ่ม', 'ไม่จำกัดทรัพย์สิน', 'กลุ่ม + Marketplace', 'AI แคปชั่น', 'ตั้งเวลาโพสต์', 'สถิติวิเคราะห์'],
  },
];

const benefits = [
  { text: 'ประหยัดเวลา 3-4 ชม./วัน ไม่ต้องนั่งโพสต์เอง', icon: Clock },
  { text: 'เข้าถึงผู้ซื้อมากขึ้น 10 เท่าผ่าน Groups + Marketplace', icon: Users },
  { text: 'AI สร้างแคปชั่นภาษาไทย ไม่ซ้ำ ไม่โดนแบน', icon: Sparkles },
  { text: 'ข้อมูลแยกต่อ user ปลอดภัย 100% ไม่ปนกัน', icon: Lock },
  { text: 'สถิติวิเคราะห์ ดูผลโพสต์แบบ real-time', icon: BarChart3 },
  { text: 'ทีมซัพพอร์ตตอบเร็ว ผ่าน LINE', icon: MessageCircle },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">Grand$tate</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/auth">เข้าสู่ระบบ</Link>
            </Button>
            <Button variant="accent" asChild>
              <Link to="/auth">
                เริ่มต้นใช้งาน
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        
        <div className="container mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-6 bg-accent/10 text-accent border-accent/20" variant="outline">
              🇹🇭 สำหรับนายหน้าอสังหาฯ ไทยโดยเฉพาะ
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              โพสต์อสังหาฯ อัตโนมัติ<br />
              <span className="gradient-text">ฉลาดกว่า เร็วกว่า ปลอดภัยกว่า</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              ระบบช่วยโพสต์อสังหาริมทรัพย์ไปยัง Facebook Groups + Marketplace อัตโนมัติ
              พร้อม AI สร้างแคปชั่น ประหยัดเวลา เพิ่มยอดขาย
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="accent" asChild>
                <Link to="/auth">
                  เริ่มต้นใช้งานฟรี
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/pricing">
                  ดูแพ็กเกจ
                  <Crown className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-6 border-y bg-muted/20">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold gradient-text">{stat.number}</p>
                <p className="font-semibold mt-1">{stat.label}</p>
                <p className="text-sm text-muted-foreground">{stat.sublabel}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20" variant="outline">
              ฟีเจอร์ครบครัน
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              ทุกเครื่องมือที่นายหน้าต้องการ
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              ครบจบในแอปเดียว จัดการทรัพย์สิน กลุ่ม โพสต์ สถิติ ทั้งหมดในที่เดียว
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full card-elevated hover:shadow-card-hover transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground/60 mb-2">{feature.titleEn}</p>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 bg-accent/10 text-accent border-accent/20" variant="outline">
                ทำไมต้อง Grand$tate?
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                มุ่งเน้นขาย<br />
                <span className="text-accent">ปล่อยให้ระบบโพสต์ให้</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                หยุดเสียเวลานั่ง copy-paste ทีละกลุ่ม Grand$tate ทำงานแทนคุณ
                ขณะที่คุณโฟกัสกับการปิดดีลและดูแลลูกค้า
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={benefit.text}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-4 h-4 text-accent" />
                    </div>
                    <span className="font-medium text-sm">{benefit.text}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/10 via-accent/10 to-purple-500/10 border p-6 md:p-8 flex flex-col justify-center">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/80 backdrop-blur shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="text-sm font-medium">เพิ่มทรัพย์สิน 5 รายการ</p><p className="text-xs text-muted-foreground">รูปภาพ + รายละเอียดครบ</p></div>
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/80 backdrop-blur shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="text-sm font-medium">เลือก 50 กลุ่มเป้าหมาย</p><p className="text-xs text-muted-foreground">กรุงเทพ + ปริมณฑล</p></div>
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/80 backdrop-blur shadow-sm border-2 border-accent/30">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="text-sm font-medium text-accent">กำลังโพสต์... 23/50 กลุ่ม</p><p className="text-xs text-muted-foreground">AI สร้างแคปชั่นให้แต่ละกลุ่ม</p></div>
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/80 backdrop-blur shadow-sm opacity-60">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-white" /></div>
                    <div className="flex-1"><p className="text-sm font-medium">ดูสถิติผลโพสต์</p><p className="text-xs text-muted-foreground">สำเร็จ 47 / ล้มเหลว 3</p></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20" variant="outline">
              แพ็กเกจ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              เลือกแพ็กเกจที่เหมาะกับคุณ
            </h2>
            <p className="text-muted-foreground text-lg">
              เริ่มต้นฟรี อัพเกรดเมื่อพร้อม
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`h-full relative overflow-hidden transition-all duration-300 hover:shadow-xl ${pkg.popular ? 'border-accent shadow-lg scale-[1.02]' : 'card-elevated'}`}>
                  {pkg.popular && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                  )}
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-4`}>
                      <pkg.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold">{pkg.name}</h3>
                    {pkg.popular && <Badge className="mt-1 bg-accent/10 text-accent text-xs">ยอดนิยม</Badge>}
                    <div className="mt-3 mb-4">
                      <span className="text-3xl font-bold">{pkg.price === 'ฟรี' ? 'ฟรี' : `฿${pkg.price}`}</span>
                      {pkg.period && <span className="text-muted-foreground text-sm">{pkg.period}</span>}
                    </div>
                    <ul className="space-y-2">
                      {pkg.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full mt-6" variant={pkg.popular ? 'accent' : 'outline'} asChild>
                      <Link to="/auth">
                        {pkg.price === 'ฟรี' ? 'เริ่มต้นฟรี' : 'สมัครเลย'}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              ปลอดภัยระดับ Enterprise
            </h2>
            <p className="text-muted-foreground mb-6">
              ข้อมูลทุกอย่างเข้ารหัสและแยกต่อผู้ใช้ ไม่มีทางปนกัน Browser session แยก
              ข้อมูลโพสต์แยก API ป้องกันด้วย JWT Authentication
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['JWT Auth', 'SSL/HTTPS', 'Data Isolation', 'Rate Limiting', 'Stealth Mode'].map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="gradient-hero text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(247,181,0,0.2)_0%,transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(247,181,0,0.1)_0%,transparent_50%)]" />
            <CardContent className="p-10 md:p-14 text-center relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                พร้อมเพิ่มยอดขายอสังหาฯ หรือยัง?
              </h2>
              <p className="text-lg text-white/70 mb-8 max-w-xl mx-auto">
                เริ่มต้นฟรีวันนี้ ไม่ต้องผูกบัตร สมัครใช้งานได้เลย
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="xl" variant="accent" asChild>
                  <Link to="/auth">
                    เริ่มต้นใช้งานฟรี
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                  <a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    ติดต่อทาง LINE
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg">Grand$tate</span>
              </div>
              <p className="text-sm text-muted-foreground">
                ระบบโพสต์อสังหาริมทรัพย์อัตโนมัติ<br />
                สำหรับนายหน้ามืออาชีพ
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">ลิงก์</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="hover:text-foreground transition-colors">เข้าสู่ระบบ</Link></li>
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">แพ็กเกจและราคา</Link></li>
                <li><a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">ติดต่อเรา (LINE)</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">นโยบาย</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">นโยบายความเป็นส่วนตัว</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors">ข้อตกลงการใช้งาน</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Grand$tate — สำหรับนายหน้าอสังหาริมทรัพย์มืออาชีพ
            </p>
            <p className="text-xs text-muted-foreground/50">Version 2.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
