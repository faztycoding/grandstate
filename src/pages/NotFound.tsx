import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { GrandStateLogo } from "@/components/GrandStateLogo";
import { Home, ArrowLeft, Building2 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6 ui-density-relaxed">
      {/* Background grid */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(38,60,100,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(38,60,100,0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Golden glow */}
      <div className="pointer-events-none fixed z-0" style={{
        top: '-15%', right: '-10%', width: '50%', height: '50%',
        background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, transparent 70%)',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center max-w-lg space-y-6"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
        >
          <GrandStateLogo className="w-16 h-16 mx-auto mb-4" />
        </motion.div>

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          <h1 className="text-8xl font-black tracking-tighter">
            <span className="text-foreground">4</span>
            <span style={{ color: '#fbbf24', textShadow: '0 0 20px rgba(251,191,36,0.4)' }}>0</span>
            <span className="text-foreground">4</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="text-xl font-bold text-foreground mb-2">ไม่พบหน้าที่ต้องการ</h2>
          <p className="text-sm text-muted-foreground">
            หน้า <code className="px-1.5 py-0.5 rounded bg-muted text-xs">{location.pathname}</code> ไม่มีอยู่ในระบบ
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-3 pt-2"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            <Home className="w-4 h-4" />
            หน้าแรก
          </Link>
          <Link
            to="/automation"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-all"
          >
            <Building2 className="w-4 h-4" />
            Automation
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            ย้อนกลับ
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs text-muted-foreground/50 pt-4"
        >
          Grand<span style={{ color: '#fbbf24' }}>$</span>tate v1.0
        </motion.p>
      </motion.div>
    </div>
  );
};

export default NotFound;
