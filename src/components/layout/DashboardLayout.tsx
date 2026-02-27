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
      <div className="min-h-screen bg-background">
        <FloatingParticles count={20} />
        <Sidebar />
        <div className="md:pl-[280px] transition-all duration-200">
          <Header title={title} subtitle={subtitle} />
          <main key={location.pathname} className="p-4 md:p-6 page-enter">
            {children}
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
