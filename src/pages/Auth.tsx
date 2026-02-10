import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Key,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  Monitor,
  Crown,
  Star,
  Rocket,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { cn } from '@/lib/utils';

type AuthView = 'signin' | 'signup' | 'forgot' | 'activate';

const packageInfo = {
  free: {
    name: 'Rookie', icon: Rocket, color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-teal-500',
    features: ['10 โพสต์/วัน', '10 กลุ่ม', '5 สินทรัพย์'],
  },
  agent: {
    name: 'Top Agent', icon: Star, color: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-500',
    features: ['300 โพสต์/วัน', '300 กลุ่ม', 'ไม่จำกัดสินทรัพย์'],
  },
  elite: {
    name: 'Elite', icon: Crown, color: 'text-purple-600',
    gradient: 'from-purple-500 to-pink-500',
    features: ['750 โพสต์/วัน', '750 กลุ่ม', 'ไม่จำกัดสินทรัพย์'],
  },
};

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    signUp, signIn, signOut, resetPassword, activateLicense,
    isValidating, license, isAuthenticated, isLicenseActive, isFullyReady,
    user,
  } = useLicenseAuth();

  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLicenseSuccess, setShowLicenseSuccess] = useState(false);

  // Handle logout param
  useEffect(() => {
    if (searchParams.get('logout') === 'true') {
      signOut();
      window.history.replaceState(null, '', '/auth');
    }
  }, [searchParams, signOut]);

  // If user is authenticated but no license → show activation
  useEffect(() => {
    if (isAuthenticated && !isLicenseActive && view !== 'activate') {
      setView('activate');
    }
  }, [isAuthenticated, isLicenseActive, view]);

  // If fully ready → redirect to app
  useEffect(() => {
    if (isFullyReady && !showLicenseSuccess && searchParams.get('logout') !== 'true') {
      const from = (location.state as { from?: string })?.from || '/automation';
      navigate(from);
    }
  }, [isFullyReady, showLicenseSuccess, navigate, location, searchParams]);

  // Redirect after license success animation
  useEffect(() => {
    if (showLicenseSuccess && license) {
      const timer = setTimeout(() => {
        const from = (location.state as { from?: string })?.from || '/automation';
        navigate(from);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showLicenseSuccess, license, navigate, location]);

  // ── Form handlers ──
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    // If success, useEffect will handle redirect or show license activation
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setIsSubmitting(true);
    const result = await signUp(email, password, fullName);
    setIsSubmitting(false);
    if (result.success) {
      if (result.error) {
        // Email confirmation needed
        setSuccessMsg(result.error);
        setView('signin');
      }
      // If auto-signed-in, useEffect handles the rest
    } else {
      setError(result.error || 'สมัครสมาชิกไม่สำเร็จ');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await resetPassword(email);
    setIsSubmitting(false);
    if (result.success) {
      setSuccessMsg('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย');
      setTimeout(() => setView('signin'), 3000);
    } else {
      setError(result.error || 'ไม่สามารถส่งอีเมลได้');
    }
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await activateLicense(licenseKey);
    setIsSubmitting(false);
    if (result.valid) {
      setShowLicenseSuccess(true);
    } else {
      setError(result.error || 'ไม่สามารถเปิดใช้งานได้');
    }
  };

  // Format license key as user types
  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (value.length > 0 && !value.startsWith('GS') && !value.startsWith('G')) {
      value = 'GS' + value;
    }
    const prefix = value.slice(0, 2);
    const rest = value.slice(2).replace(/-/g, '');
    if (rest.length > 0) {
      const parts = [];
      parts.push(rest.slice(0, 3));
      for (let i = 3; i < rest.length && i < 18; i += 5) {
        parts.push(rest.slice(i, i + 5));
      }
      value = prefix + parts.join('-');
    }
    setLicenseKey(value);
    setError(null);
  };

  const switchView = (v: AuthView) => {
    setView(v);
    setError(null);
    setSuccessMsg(null);
  };

  // ── License Success Screen ──
  if (showLicenseSuccess && license) {
    const pkg = packageInfo[license.package];
    const Icon = pkg.icon;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-accent/5">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="border-0 shadow-2xl overflow-hidden">
            <div className={cn('h-2 bg-gradient-to-r', pkg.gradient)} />
            <CardContent className="p-8 text-center space-y-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                className={cn('w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center', pkg.gradient)}>
                <Icon className="w-10 h-10 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold mb-2">ยินดีต้อนรับ! 🎉</h2>
                <p className="text-muted-foreground">
                  {user?.email && <span className="block text-sm mb-1">{user.email}</span>}
                  เปิดใช้งานแพ็คเกจ <span className={cn('font-bold', pkg.color)}>{pkg.name}</span> สำเร็จ
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                {pkg.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>หมดอายุ: {license.expiresAt.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent" />
                <p className="text-sm text-muted-foreground mt-2">กำลังเข้าสู่ระบบ...</p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Main Layout ──
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(247,181,0,0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(247,181,0,0.1)_0%,transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shadow-glow">
              <Building2 className="w-6 h-6 text-accent-foreground" />
            </div>
            <span className="text-2xl font-bold">Grand$tate</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              โพสต์อสังหาฯ อัตโนมัติ<br />
              <span className="gradient-text">ฉลาดกว่า เร็วกว่า ปลอดภัยกว่า</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md">
              ระบบช่วยโพสต์อสังหาริมทรัพย์ไปยัง Facebook Groups อัตโนมัติ ประหยัดเวลา เพิ่มยอดขาย
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              {[
                { icon: Sparkles, text: 'AI สร้าง Caption' },
                { icon: Shield, text: 'ปลอดภัย ไม่โดนแบน' },
                { icon: Clock, text: 'ตั้งเวลาโพสต์' },
                { icon: Monitor, text: 'Sync ข้อมูลข้ามเครื่อง' },
              ].map(({ icon: Ic, text }) => (
                <div key={text} className="flex items-center gap-3 p-3 rounded-lg bg-white/10">
                  <Ic className="w-5 h-5 text-accent" />
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <p className="text-sm text-white/50">© 2025 Grand$tate — สำหรับนายหน้าอสังหาริมทรัพย์มืออาชีพ</p>
        </div>
      </div>

      {/* Right side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">Grand$tate</span>
          </div>

          <AnimatePresence mode="wait">
            {/* ════════ SIGN IN ════════ */}
            {view === 'signin' && (
              <motion.div key="signin" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Card className="border-0 shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center mb-4">
                      <Mail className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">เข้าสู่ระบบ</CardTitle>
                    <CardDescription>ใช้อีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">อีเมล</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="email" type="email" placeholder="your@email.com" value={email}
                            onChange={e => { setEmail(e.target.value); setError(null); }}
                            className="pl-10 h-11" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="password">รหัสผ่าน</Label>
                          <button type="button" className="text-xs text-accent hover:underline" onClick={() => switchView('forgot')}>
                            ลืมรหัสผ่าน?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                            onChange={e => { setPassword(e.target.value); setError(null); }}
                            className="pl-10 pr-10 h-11" required />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}
                      {successMsg && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
                        </div>
                      )}

                      <Button type="submit" className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                        disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ<ArrowRight className="w-4 h-4 ml-2" /></>}
                      </Button>
                    </form>

                    <div className="mt-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        ยังไม่มีบัญชี?{' '}
                        <button className="text-accent hover:underline font-medium" onClick={() => switchView('signup')}>สมัครสมาชิก</button>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ════════ SIGN UP ════════ */}
            {view === 'signup' && (
              <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-0 shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">สมัครสมาชิก</CardTitle>
                    <CardDescription>สร้างบัญชีใหม่เพื่อเริ่มใช้งาน</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">ชื่อ-นามสกุล</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="fullName" placeholder="เช่น สมชาย ใจดี" value={fullName}
                            onChange={e => setFullName(e.target.value)} className="pl-10 h-11" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signupEmail">อีเมล</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="signupEmail" type="email" placeholder="your@email.com" value={email}
                            onChange={e => { setEmail(e.target.value); setError(null); }} className="pl-10 h-11" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signupPassword">รหัสผ่าน</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="signupPassword" type={showPassword ? 'text' : 'password'} placeholder="อย่างน้อย 6 ตัวอักษร" value={password}
                            onChange={e => { setPassword(e.target.value); setError(null); }} className="pl-10 pr-10 h-11" required minLength={6} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}

                      <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold"
                        disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังสร้างบัญชี...</> : <>สมัครสมาชิก<ArrowRight className="w-4 h-4 ml-2" /></>}
                      </Button>
                    </form>

                    <div className="mt-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        มีบัญชีแล้ว?{' '}
                        <button className="text-accent hover:underline font-medium" onClick={() => switchView('signin')}>เข้าสู่ระบบ</button>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ════════ FORGOT PASSWORD ════════ */}
            {view === 'forgot' && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-0 shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-4">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">ลืมรหัสผ่าน</CardTitle>
                    <CardDescription>กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="resetEmail">อีเมล</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="resetEmail" type="email" placeholder="your@email.com" value={email}
                            onChange={e => { setEmail(e.target.value); setError(null); }} className="pl-10 h-11" required />
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}
                      {successMsg && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
                        </div>
                      )}

                      <Button type="submit" className="w-full h-11 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-semibold"
                        disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังส่ง...</> : <>ส่งลิงก์รีเซ็ตรหัสผ่าน</>}
                      </Button>
                    </form>

                    <div className="mt-6 text-center">
                      <button className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => switchView('signin')}>
                        <ArrowLeft className="w-3 h-3" /> กลับไปหน้าเข้าสู่ระบบ
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ════════ ACTIVATE LICENSE ════════ */}
            {view === 'activate' && (
              <motion.div key="activate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="border-0 shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center mb-4">
                      <Key className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">เปิดใช้งาน License</CardTitle>
                    <CardDescription>
                      {user?.email && <span className="block text-xs text-accent mb-1">{user.email}</span>}
                      กรอก License Key เพื่อเริ่มใช้งานระบบ
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleActivateLicense} className="space-y-4">
                      <div className="space-y-2">
                        <Input value={licenseKey} onChange={handleKeyChange} placeholder="GSXXX-XXXXX-XXXXX-XXXXX"
                          className={cn('h-14 text-center text-lg font-mono tracking-wider', error && 'border-red-500')} maxLength={23} />
                        <p className="text-xs text-center text-muted-foreground">ได้รับ License Key จากผู้ดูแลระบบ</p>
                      </div>

                      {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}

                      <Button type="submit" className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                        disabled={isSubmitting || isValidating || licenseKey.length < 23}>
                        {isSubmitting || isValidating
                          ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />กำลังตรวจสอบ...</>
                          : <>เปิดใช้งาน<ArrowRight className="w-5 h-5 ml-2" /></>}
                      </Button>
                    </form>

                    {/* Package Cards */}
                    <div className="mt-6 pt-6 border-t space-y-3">
                      <p className="text-xs text-center text-muted-foreground">แพ็คเกจที่รองรับ</p>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(packageInfo).map(([key, pkg]) => {
                          const Icon = pkg.icon;
                          return (
                            <div key={key} className="p-3 rounded-lg bg-muted/50 text-center">
                              <div className={cn('w-8 h-8 mx-auto rounded-lg bg-gradient-to-br flex items-center justify-center mb-2', pkg.gradient)}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <p className="text-xs font-medium">{pkg.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sign out link */}
                    <div className="mt-4 text-center">
                      <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { signOut(); switchView('signin'); }}>
                        ออกจากระบบ
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contact + Admin (show only on sign-in/sign-up) */}
          {(view === 'signin' || view === 'signup') && (
            <>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                ต้องการ License Key?{' '}
                <a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline font-medium">ติดต่อทาง LINE</a>
              </p>
              <div className="mt-4 pt-4 border-t border-dashed">
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={() => navigate('/admin-login')}>
                  <Shield className="w-4 h-4 mr-2" />สำหรับผู้ดูแลระบบ
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
