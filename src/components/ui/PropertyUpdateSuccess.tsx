import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PropertyUpdateSuccessProps {
  show: boolean;
  mode: 'update' | 'add';
  onClose: () => void;
}

export function PropertyUpdateSuccess({ show, mode, onClose }: PropertyUpdateSuccessProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  const isUpdate = mode === 'update';
  const title = isUpdate ? 'อัปเดตสินทรัพย์สำเร็จ' : 'เพิ่มสินทรัพย์สำเร็จ';
  const subtitle = isUpdate ? 'รายละเอียดของคุณถูกบันทึกแล้ว' : 'สินทรัพย์ใหม่ถูกเพิ่มแล้ว';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-6 right-6 z-[70] bg-gradient-to-br from-emerald-500/95 via-emerald-600/95 to-emerald-700/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-emerald-400/25 p-5 max-w-sm"
        >
          <div className="flex items-start gap-4">
            {/* Icon with pulse */}
            <div className="relative flex-shrink-0">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.6, ease: 'easeInOut', repeat: 2 }}
              >
                <CheckCircle2 className="w-8 h-8 text-white drop-shadow-lg" />
              </motion.div>
              {/* Glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-300/30 blur-xl"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
              />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight mb-1">{title}</h3>
              <p className="text-emerald-50 text-sm leading-relaxed">{subtitle}</p>
            </div>

            {/* Property icon */}
            <div className="flex-shrink-0 opacity-60">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {/* Bottom shimmer line */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, ease: 'linear', repeat: Infinity, repeatDelay: 0.5 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
