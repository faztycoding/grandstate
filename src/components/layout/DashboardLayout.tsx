import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, MobileSidebarProvider } from './Sidebar';
import { Header } from './Header';
import { FloatingParticles } from '@/components/ui/floating-particles';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const location = useLocation();

  return (
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
        <Sidebar />
        <div className="md:pl-[280px] transition-all duration-200 relative z-10">
          <Header title={title} subtitle={subtitle} />
          <main key={location.pathname} className="p-4 md:p-6 page-enter">
            {children}
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
