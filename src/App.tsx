import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Automation from "./pages/Automation";
import CreateMarketplaceListing from "./pages/CreateMarketplaceListing";
import PropertyGallery from "./pages/PropertyGallery";
import Properties from "./pages/Properties";
import Settings from "./pages/Settings";
import Groups from "./pages/Groups";
import Help from "./pages/Help";
import Pricing from "./pages/Pricing";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import AdminDashboard from "./pages/AdminDashboard";
import UserProfile from "./pages/UserProfile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/checkout" element={<Checkout />} />
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

              {/* Admin route - uses secret URL token */}
              <Route path="/admin/:secret" element={<AdminDashboard />} />

              {/* Redirects for old routes */}
              <Route path="/dashboard" element={<Navigate to="/automation" replace />} />
              <Route path="/post" element={<Navigate to="/automation" replace />} />
              <Route path="/captions" element={<Navigate to="/automation" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
