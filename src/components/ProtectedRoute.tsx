import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLicenseActive, isFullyReady, isLoading } = useLicenseAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isLoading && !isFullyReady) {
            // Redirect to auth page, save intended destination
            navigate('/auth', { state: { from: location.pathname } });
        }
    }, [isLoading, isFullyReady, navigate, location]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto" />
                    <p className="text-muted-foreground">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!isFullyReady) {
        return null;
    }

    return <>{children}</>;
}
