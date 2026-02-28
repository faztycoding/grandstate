import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { isAdminEmail } from '@/lib/config';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useLicenseAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdminEmail(user.email)) {
    return <Navigate to="/automation" replace />;
  }

  return <>{children}</>;
}
