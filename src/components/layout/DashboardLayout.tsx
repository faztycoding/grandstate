import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, MobileSidebarProvider } from './Sidebar';
import { Header } from './Header';
import { FloatingParticles } from '@/components/ui/floating-particles';

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
        {/* ── Grand$tate Premium Background Layers ── */}

        {/* Layer 1: Subtle geometric grid — real estate blueprint feel */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(38,60,100,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(38,60,100,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Layer 2: Warm golden radial glow — top right accent */}
        <div
          className="pointer-events-none fixed z-0"
          style={{
            top: '-10%',
            right: '-5%',
            width: '50%',
            height: '50%',
            background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.06) 0%, rgba(245,158,11,0.03) 40%, transparent 70%)',
          }}
        />

        {/* Layer 3: Deep navy radial glow — bottom left accent */}
        <div
          className="pointer-events-none fixed z-0"
          style={{
            bottom: '-10%',
            left: '-5%',
            width: '55%',
            height: '55%',
            background: 'radial-gradient(ellipse at center, rgba(30,58,110,0.05) 0%, rgba(30,58,110,0.02) 40%, transparent 70%)',
          }}
        />

        {/* Layer 4: Diagonal accent stripe — subtle premium ribbon */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              135deg,
              transparent,
              transparent 80px,
              rgba(251,191,36,0.4) 80px,
              rgba(251,191,36,0.4) 81px
            )`,
          }}
        />

        {/* Layer 5: Soft vignette — draws focus to center content */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.02) 100%)',
          }}
        />

        <FloatingParticles count={20} />
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
