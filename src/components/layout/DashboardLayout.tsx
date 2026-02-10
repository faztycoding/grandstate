import { ReactNode } from 'react';
import { Sidebar, MobileSidebarProvider } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <MobileSidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-[280px] transition-all duration-200">
          <Header title={title} subtitle={subtitle} />
          <main className="p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
