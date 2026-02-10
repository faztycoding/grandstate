import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Zap, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';

const ONBOARDING_KEY = 'grandstate_onboarded';

interface Step {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}

export function WelcomeModal() {
  const { t } = useLanguage();
  const o = t.onboarding;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setOpen(true);
  }, []);

  const steps: Step[] = [
    {
      icon: <Building2 className="w-8 h-8" />,
      title: o.step1Title,
      desc: o.step1Desc,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: o.step2Title,
      desc: o.step2Desc,
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: o.step3Title,
      desc: o.step3Desc,
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: o.step4Title,
      desc: o.step4Desc,
      color: 'from-green-500 to-emerald-500',
    },
  ];

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOpen(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const currentStep = steps[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header gradient */}
        <div className={cn('p-8 text-center text-white bg-gradient-to-br', currentStep.color)}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                {currentStep.icon}
              </div>
              {step === 0 && (
                <div className="mb-3">
                  <Badge className="bg-white/20 text-white border-white/30 mb-2">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Grand$tate v1.0
                  </Badge>
                </div>
              )}
              <h2 className="text-xl font-bold mb-2">
                {step === 0 ? o.welcomeTitle : currentStep.title}
              </h2>
              <p className="text-white/80 text-sm leading-relaxed">
                {step === 0 ? o.welcomeDesc : currentStep.desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Steps & content */}
        <div className="p-6 space-y-5">
          {step === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <h3 className="font-semibold text-center">{o.stepsOverview}</h3>
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center text-sm font-bold', s.color)}>
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium flex-1">{s.title}</span>
                </div>
              ))}
            </motion.div>
          )}

          {step > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="p-4 rounded-xl bg-muted/50 text-center"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{currentStep.desc}</p>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === step ? 'w-6 bg-accent' : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                {o.back}
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
              {step === steps.length - 1 ? o.getStarted : o.next}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {step === 0 && (
            <button onClick={handleFinish} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
              {o.skip}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
