import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Key,
  ArrowRight,
  ArrowLeft,
  Loader2,
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
import { GrandStateLogo } from '@/components/GrandStateLogo';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';

type AuthView = 'signin' | 'signup' | 'forgot' | 'activate';

const packageInfo = {
  free: {
    name: 'Rookie', icon: Rocket, color: 'text-emerald-600',
    gradient: 'from-emerald-500 to-teal-500',
    features: ['10 โพสต์/วัน', '10 กลุ่ม', '10 สินทรัพย์'],
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
  const { language } = useLanguage();
  const isEn = language === 'en';
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
      setView('signin');
      window.history.replaceState(null, '', '/auth');
    }
  }, [searchParams, signOut]);

  // If user is authenticated → redirect to app (free tier by default)
  // License activation is optional — available in Settings for upgrading

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
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#070b14] ui-density-relaxed">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(247,181,0,0.08)_0%,transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-md">
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/40 rounded-2xl overflow-hidden">
            <div className={cn('h-1 bg-gradient-to-r', pkg.gradient)} />
            <div className="p-8 text-center space-y-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                className={cn('w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center ring-1 ring-white/10 shadow-lg', pkg.gradient)}>
                <Icon className="w-10 h-10 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{isEn ? 'Welcome!' : 'ยินดีต้อนรับ!'}</h2>
                <p className="text-white/50">
                  {user?.email && <span className="block text-sm text-white/30 mb-1">{user.email}</span>}
                  {isEn ? 'Activated' : 'เปิดใช้งานแพ็คเกจ'} <span className="font-bold text-amber-400">{pkg.name}</span> {isEn ? 'successfully' : 'สำเร็จ'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                {pkg.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-white/30">
                <Clock className="w-4 h-4" />
                <span>{isEn ? 'Expires:' : 'หมดอายุ:'} {license.expiresAt.toLocaleDateString(isEn ? 'en-US' : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" />
                <p className="text-sm text-white/30 mt-2">{isEn ? 'Redirecting...' : 'กำลังเข้าสู่ระบบ...'}</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Shared styles ──
  const glassCard = "bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/40 rounded-2xl";
  const glassInput = "bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/30 focus:border-amber-400/50 focus:ring-amber-400/20 h-12";
  const glassLabel = "text-white/60 text-sm font-medium";
  const errorBox = "p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2";
  const successBox = "p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2";

  // ── Main Layout ──
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#070b14] ui-density-relaxed">
      {/* ── Cinematic City Video Background ── */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ filter: 'saturate(0.8) brightness(0.45) sepia(0.15)' }}
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'%3E%3Crect fill='%23070b14'/%3E%3C/svg%3E"
        >
          <source src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4" type="video/mp4" />
        </video>

        {/* Multi-layer cinematic overlays — warm amber/orange tone */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0704]/80 via-[#0a0704]/40 to-[#0a0704]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/40 via-transparent to-orange-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0704_100%)]" />

        {/* Warm amber glow — center focus */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(245,158,11,0.12)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_60%,rgba(251,146,60,0.06)_0%,transparent_40%)]" />

        {/* Horizon glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0a0704] to-transparent" />

        {/* Subtle vignette */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 60px rgba(0,0,0,0.5)' }} />
      </div>

      {/* Floating gold particles over video */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              left: `${8 + i * 7.5}%`,
              top: `${10 + (i % 5) * 18}%`,
              background: i % 3 === 0 ? 'rgba(251,191,36,0.5)' : i % 3 === 1 ? 'rgba(251,146,60,0.4)' : 'rgba(245,158,11,0.35)',
            }}
            animate={{ y: [-20, 20, -20], opacity: [0.1, 0.6, 0.1] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }} />
        ))}
        {/* Accent light streaks */}
        <motion.div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/10 to-transparent"
          animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 5, repeat: Infinity }} />
        <motion.div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/10 to-transparent"
          animate={{ opacity: [0.15, 0.4, 0.15] }} transition={{ duration: 6, repeat: Infinity, delay: 1 }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-[420px] px-5">
        {/* GrandState Logo */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, type: 'spring' }}
          className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <GrandStateLogo heroMode className="w-12 h-12 drop-shadow-[0_0_12px_rgba(247,181,0,0.3)]" />
            <span className="text-[26px] font-bold text-white tracking-wide">Grand<span style={{ color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.7), 0 0 20px rgba(251,191,36,0.4)' }}>$</span>tate</span>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ════════ SIGN IN ════════ */}
          {view === 'signin' && (
            <motion.div key="signin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
              <div className={glassCard}>
                <div className="p-7 pb-0 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/90 to-orange-500/90 flex items-center justify-center mb-4 ring-1 ring-amber-400/20 shadow-lg shadow-amber-500/20">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{isEn ? 'Sign In' : 'เข้าสู่ระบบ'}</h2>
                  <p className="text-white/40 text-sm">{isEn ? 'Enter your email and password' : 'ใช้อีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ'}</p>
                </div>
                <div className="p-7">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className={glassLabel}>{isEn ? 'Email' : 'อีเมล'}</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input id="email" type="email" placeholder="your@email.com" value={email}
                          onChange={e => { setEmail(e.target.value); setError(null); }}
                          className={cn("pl-11", glassInput)} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className={glassLabel}>{isEn ? 'Password' : 'รหัสผ่าน'}</label>
                        <button type="button" className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors" onClick={() => switchView('forgot')}>
                          {isEn ? 'Forgot?' : 'ลืมรหัสผ่าน?'}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                          onChange={e => { setPassword(e.target.value); setError(null); }}
                          className={cn("pl-11 pr-11", glassInput)} required />
                        <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className={errorBox}>
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}
                    {successMsg && (
                      <div className={successBox}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-emerald-400">{successMsg}</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-base shadow-lg shadow-amber-500/25 border-0 transition-all duration-200 btn-shine"
                      disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEn ? 'Signing in...' : 'กำลังเข้าสู่ระบบ...'}</> : <>{isEn ? 'Sign In' : 'เข้าสู่ระบบ'}<ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-white/35">
                      {isEn ? "Don't have an account?" : 'ยังไม่มีบัญชี?'}{' '}
                      <button className="text-amber-400 hover:text-amber-300 font-medium transition-colors" onClick={() => switchView('signup')}>{isEn ? 'Sign Up' : 'สมัครสมาชิก'}</button>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ SIGN UP ════════ */}
          {view === 'signup' && (
            <motion.div key="signup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
              <div className={glassCard}>
                <div className="p-7 pb-0 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/90 to-cyan-500/90 flex items-center justify-center mb-4 ring-1 ring-blue-400/20 shadow-lg shadow-blue-500/20">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{isEn ? 'Sign Up' : 'สมัครสมาชิก'}</h2>
                  <p className="text-white/40 text-sm">{isEn ? 'Create a new account to get started' : 'สร้างบัญชีใหม่เพื่อเริ่มใช้งาน'}</p>
                </div>
                <div className="p-7">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className={glassLabel}>{isEn ? 'Full Name' : 'ชื่อ-นามสกุล'}</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input id="fullName" placeholder={isEn ? 'John Doe' : 'เช่น สมชาย ใจดี'} value={fullName}
                          onChange={e => setFullName(e.target.value)} className={cn("pl-11", glassInput)} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={glassLabel}>{isEn ? 'Email' : 'อีเมล'}</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input id="signupEmail" type="email" placeholder="your@email.com" value={email}
                          onChange={e => { setEmail(e.target.value); setError(null); }} className={cn("pl-11", glassInput)} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={glassLabel}>{isEn ? 'Password' : 'รหัสผ่าน'}</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input id="signupPassword" type={showPassword ? 'text' : 'password'} placeholder={isEn ? 'Min 6 characters' : 'อย่างน้อย 6 ตัวอักษร'} value={password}
                          onChange={e => { setPassword(e.target.value); setError(null); }} className={cn("pl-11 pr-11", glassInput)} required minLength={6} />
                        <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className={errorBox}>
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold text-base shadow-lg shadow-blue-500/25 border-0 transition-all duration-200 btn-shine"
                      disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEn ? 'Creating account...' : 'กำลังสร้างบัญชี...'}</> : <>{isEn ? 'Sign Up' : 'สมัครสมาชิก'}<ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-white/35">
                      {isEn ? 'Already have an account?' : 'มีบัญชีแล้ว?'}{' '}
                      <button className="text-amber-400 hover:text-amber-300 font-medium transition-colors" onClick={() => switchView('signin')}>{isEn ? 'Sign In' : 'เข้าสู่ระบบ'}</button>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ FORGOT PASSWORD ════════ */}
          {view === 'forgot' && (
            <motion.div key="forgot" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
              <div className={glassCard}>
                <div className="p-7 pb-0 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/90 to-purple-500/90 flex items-center justify-center mb-4 ring-1 ring-violet-400/20 shadow-lg shadow-violet-500/20">
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{isEn ? 'Forgot Password' : 'ลืมรหัสผ่าน'}</h2>
                  <p className="text-white/40 text-sm">{isEn ? 'Enter your email to receive a reset link' : 'กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน'}</p>
                </div>
                <div className="p-7">
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className={glassLabel}>{isEn ? 'Email' : 'อีเมล'}</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input id="resetEmail" type="email" placeholder="your@email.com" value={email}
                          onChange={e => { setEmail(e.target.value); setError(null); }} className={cn("pl-11", glassInput)} required />
                      </div>
                    </div>

                    {error && (
                      <div className={errorBox}>
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}
                    {successMsg && (
                      <div className={successBox}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-emerald-400">{successMsg}</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-bold text-base shadow-lg shadow-violet-500/25 border-0 transition-all duration-200"
                      disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEn ? 'Sending...' : 'กำลังส่ง...'}</> : <>{isEn ? 'Send Reset Link' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}</>}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <button className="text-sm text-white/35 hover:text-white/60 inline-flex items-center gap-1.5 transition-colors" onClick={() => switchView('signin')}>
                      <ArrowLeft className="w-3.5 h-3.5" /> {isEn ? 'Back to Sign In' : 'กลับไปหน้าเข้าสู่ระบบ'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════ ACTIVATE LICENSE ════════ */}
          {view === 'activate' && (
            <motion.div key="activate" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
              <div className={glassCard}>
                <div className="p-7 pb-0 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/90 to-orange-500/90 flex items-center justify-center mb-4 ring-1 ring-amber-400/20 shadow-lg shadow-amber-500/20">
                    <Key className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{isEn ? 'Activate License' : 'เปิดใช้งาน License'}</h2>
                  <div className="text-white/40 text-sm">
                    {user?.email && <span className="block text-xs text-amber-400/70 mb-1">{user.email}</span>}
                    {isEn ? 'Enter your License Key to get started' : 'กรอก License Key เพื่อเริ่มใช้งานระบบ'}
                  </div>
                </div>
                <div className="p-7">
                  <form onSubmit={handleActivateLicense} className="space-y-4">
                    <div className="space-y-2">
                      <Input value={licenseKey} onChange={handleKeyChange} placeholder="GSXXX-XXXXX-XXXXX-XXXXX"
                        className={cn('h-14 text-center text-lg font-mono tracking-wider bg-white/[0.06] border-white/[0.1] text-white placeholder:text-white/25 focus:border-amber-400/50 focus:ring-amber-400/20', error && 'border-red-500/50')} maxLength={23} />
                      <p className="text-xs text-center text-white/30">{isEn ? 'Received from your administrator' : 'ได้รับ License Key จากผู้ดูแลระบบ'}</p>
                    </div>

                    {error && (
                      <div className={errorBox}>
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-base shadow-lg shadow-amber-500/25 border-0 transition-all duration-200 btn-shine"
                      disabled={isSubmitting || isValidating || licenseKey.length < 23}>
                      {isSubmitting || isValidating
                        ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{isEn ? 'Verifying...' : 'กำลังตรวจสอบ...'}</>
                        : <>{isEn ? 'Activate' : 'เปิดใช้งาน'}<ArrowRight className="w-5 h-5 ml-2" /></>}
                    </Button>
                  </form>

                  {/* Package Cards */}
                  <div className="mt-6 pt-6 border-t border-white/[0.06] space-y-3">
                    <p className="text-xs text-center text-white/30">{isEn ? 'Supported packages' : 'แพ็คเกจที่รองรับ'}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(packageInfo).map(([key, pkg]) => {
                        const Icon = pkg.icon;
                        return (
                          <div key={key} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center hover:bg-white/[0.06] transition-colors">
                            <div className={cn('w-8 h-8 mx-auto rounded-lg bg-gradient-to-br flex items-center justify-center mb-2', pkg.gradient)}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-xs font-medium text-white/60">{pkg.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sign out link */}
                  <div className="mt-4 text-center">
                    <button className="text-xs text-white/25 hover:text-white/50 transition-colors" onClick={() => { signOut(); switchView('signin'); }}>
                      {isEn ? 'Sign out' : 'ออกจากระบบ'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contact + Admin (show only on sign-in/sign-up) */}
        {(view === 'signin' || view === 'signup') && (
          <>
            <p className="mt-6 text-center text-sm text-white/25">
              {isEn ? 'Want to upgrade?' : 'ต้องการอัพเกรดแพ็คเกจ?'}{' '}
              <a href="https://line.me/ti/p/@897hrloe" target="_blank" rel="noopener noreferrer"
                className="text-amber-400/70 hover:text-amber-400 font-medium transition-colors">{isEn ? 'Contact via LINE' : 'ติดต่อทาง LINE'}</a>
            </p>
          </>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-white/15">
          {isEn ? '© 2026 GrandState — for professional agents' : '© 2026 GrandState — สำหรับนายหน้ามืออาชีพ'}
        </p>
      </motion.div>
    </div>
  );
}
