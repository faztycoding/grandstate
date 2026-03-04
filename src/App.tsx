import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { LicenseAuthProvider } from "@/hooks/useLicenseAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoute } from "@/components/AdminRoute";
import { CookieConsent } from "@/components/CookieConsent";
import { AutomationMonitorProvider } from "@/components/layout/DashboardLayout";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

// Auto-retry: if dynamic import fails (stale chunk after deploy), reload page once
function lazyRetry(importer: () => Promise<any>) {
  return lazy(() =>
    importer().catch(() => {
      const key = 'grandstate_chunk_retry';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {}); // never resolves — page reloads
      }
      sessionStorage.removeItem(key);
      return importer(); // 2nd attempt — let it throw to ErrorBoundary if still fails
    })
  );
}

// Lazy-load all pages for smaller initial bundle
const Auth = lazyRetry(() => import("./pages/Auth"));
const Automation = lazyRetry(() => import("./pages/Automation"));
const CreateMarketplaceListing = lazyRetry(() => import("./pages/CreateMarketplaceListing"));
const PropertyGallery = lazyRetry(() => import("./pages/PropertyGallery"));
const Properties = lazyRetry(() => import("./pages/Properties"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const Groups = lazyRetry(() => import("./pages/Groups"));
const Help = lazyRetry(() => import("./pages/Help"));
const Pricing = lazyRetry(() => import("./pages/Pricing"));
const Analytics = lazyRetry(() => import("./pages/Analytics"));
const AdminDashboard = lazyRetry(() => import("./pages/AdminDashboard"));
const UserProfile = lazyRetry(() => import("./pages/UserProfile"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyRetry(() => import("./pages/TermsOfService"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <LicenseAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AutomationMonitorProvider>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center flex-col gap-4"><div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" /><p className="text-sm text-muted-foreground animate-pulse">Loading...</p></div>}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />

              {/* Protected routes - require valid license */}
              <Route path="/automation" element={<ProtectedRoute><Automation /></ProtectedRoute>} />
              <Route path="/create-listing" element={<ProtectedRoute><CreateMarketplaceListing /></ProtectedRoute>} />
              <Route path="/gallery" element={<ProtectedRoute><PropertyGallery /></ProtectedRoute>} />
              <Route path="/properties" element={<ProtectedRoute><Properties /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

              {/* Admin route — protected by email check */}
              <Route path="/adminfaz" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

              {/* Redirects for old routes */}
              <Route path="/dashboard" element={<Navigate to="/automation" replace />} />
              <Route path="/post" element={<Navigate to="/automation" replace />} />
              <Route path="/captions" element={<Navigate to="/automation" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </AutomationMonitorProvider>
          </BrowserRouter>
          <CookieConsent />
        </TooltipProvider>
        </LicenseAuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
