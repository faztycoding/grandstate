import { ReactNode, Suspense, useState, useEffect, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, MobileSidebarProvider } from './Sidebar';
import { Header } from './Header';
import { FloatingParticles } from '@/components/ui/floating-particles';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { ExpiredLicensePopup } from '@/components/profile/ExpiredLicensePopup';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { useAutomationMonitor } from '@/hooks/useAutomationMonitor';
import { TaskProgressPopup } from '@/components/automation/TaskProgressPopup';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';

// Global automation context so Automation page can notify when automation starts
type AutomationMonitorReturn = ReturnType<typeof useAutomationMonitor>;
const AutomationMonitorContext = createContext<AutomationMonitorReturn | null>(null);
export function useGlobalAutomation() {
  return useContext(AutomationMonitorContext);
}

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const location = useLocation();
  const { license, user: authUser } = useLicenseAuth();
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);
  const automationMonitor = useAutomationMonitor();
  const { user: fbUser, sessions: fbSessions, activeSlot } = useFacebookConnection();

  // Derive FB user for popup
  const fbSlotUser = fbSessions?.[activeSlot];
  const popupFbUser = fbSlotUser?.name ? { name: fbSlotUser.name, profilePic: fbSlotUser.profilePic || undefined } : fbUser || null;

  // Global expired license check — triggers once per session
  useEffect(() => {
    if (!license?.expiresAt) return;
    const now = new Date();
    const expiry = new Date(license.expiresAt);
    if (expiry <= now) {
      const key = `global_expired_shown_${license.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, 'true');
        const timer = setTimeout(() => setShowExpiredPopup(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [license]);

  return (
    <AutomationMonitorContext.Provider value={automationMonitor}>
    <MobileSidebarProvider>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* ── Grand$tate Estate Background ── */}

        {/* Layer 1: Blueprint grid — visible estate architecture feel */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.07] dark:opacity-[0.08]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249,115,22,0.25) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249,115,22,0.25) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Layer 2: Warm orange/amber glow — top right */}
        <div
          className="pointer-events-none fixed z-0"
          style={{
            top: '-8%',
            right: '-8%',
            width: '55%',
            height: '55%',
            background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.12) 0%, rgba(245,158,11,0.06) 35%, transparent 65%)',
          }}
        />

        {/* Layer 3: Cool blue glow — bottom left */}
        <div
          className="pointer-events-none fixed z-0"
          style={{
            bottom: '-8%',
            left: '-8%',
            width: '55%',
            height: '55%',
            background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.03) 35%, transparent 65%)',
          }}
        />

        {/* Layer 4: Diagonal gold accent stripes */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              135deg,
              transparent,
              transparent 60px,
              rgba(251,191,36,0.5) 60px,
              rgba(251,191,36,0.5) 61px
            )`,
          }}
        />

        {/* Layer 5: Subtle center-to-edge vignette */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.03) 100%)',
          }}
        />

        {/* Layer 6: Warm top gradient wash */}
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[40vh]"
          style={{
            background: 'linear-gradient(180deg, rgba(249,115,22,0.04) 0%, transparent 100%)',
          }}
        />

        <FloatingParticles count={25} />
        <WelcomeModal />
        <ExpiredLicensePopup
          show={showExpiredPopup}
          userId={authUser?.id}
          onClose={() => setShowExpiredPopup(false)}
        />
        <Sidebar />
        <div className="md:pl-[280px] transition-all duration-200 relative z-10">
          <Header title={title} subtitle={subtitle} />
          <main className="px-4 pt-5 pb-8 sm:px-6 lg:px-8">
            <Suspense fallback={
              <div className="flex items-center justify-center py-32 flex-col gap-3">
                <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
              </div>
            }>
              <div className="app-page-frame">
                <div key={location.pathname} className="page-enter ui-section-gap ui-density-relaxed ui-contrast-boost">
                  {children}
                </div>
              </div>
            </Suspense>
          </main>
        </div>
        {/* Global Automation Progress Popup — persists across all pages */}
        {automationMonitor.showPopup && (
          <TaskProgressPopup
            isRunning={automationMonitor.state.isRunning}
            isPaused={automationMonitor.state.isPaused}
            tasks={automationMonitor.state.tasks}
            totalSteps={automationMonitor.state.totalSteps}
            completedTasks={automationMonitor.completedTasks}
            failedTasks={automationMonitor.failedTasks}
            progressPercent={automationMonitor.progressPercent}
            generatedCaptions={automationMonitor.state.generatedCaptions}
            logs={automationMonitor.state.logs}
            startTime={automationMonitor.state.startTime}
            endTime={automationMonitor.state.endTime}
            queuePosition={automationMonitor.state.queuePosition}
            queueEstimate={automationMonitor.state.queueEstimate}
            queueRunningJobs={automationMonitor.state.queueRunningJobs}
            orderId={automationMonitor.state.orderId}
            fbUser={popupFbUser}
            onStop={automationMonitor.stopAutomation}
            onPause={automationMonitor.pauseAutomation}
            onDismiss={automationMonitor.dismissPopup}
          />
        )}
      </div>
    </MobileSidebarProvider>
    </AutomationMonitorContext.Provider>
  );
}
