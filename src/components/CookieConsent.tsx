import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

const COOKIE_KEY = 'grandstate_cookie_consent';

export function CookieConsent() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground mb-1">
                  {isEn ? 'Cookie Notice' : 'การใช้คุกกี้'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? 'We use cookies to improve your experience and keep you logged in. By continuing, you agree to our '
                    : 'เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งานและรักษาสถานะการเข้าสู่ระบบ โดยการใช้งานต่อ ถือว่าคุณยอมรับ '}
                  <a href="/privacy" className="text-accent hover:underline font-medium">
                    {isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
                  </a>
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" onClick={accept} className="h-8 text-xs font-bold px-4">
                    {isEn ? 'Accept' : 'ยอมรับ'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={decline} className="h-8 text-xs text-muted-foreground">
                    {isEn ? 'Decline' : 'ปฏิเสธ'}
                  </Button>
                </div>
              </div>
              <button onClick={decline} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
