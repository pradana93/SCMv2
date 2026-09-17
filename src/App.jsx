import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';
import { Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/shipping/AppLayout';
import FeatureRoute from '@/components/FeatureRoute';

const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Shipments = React.lazy(() => import('@/pages/Shipments'));
const Admin = React.lazy(() => import('@/pages/Admin'));
const Report = React.lazy(() => import('@/pages/Report'));
const SuperAdmin = React.lazy(() => import('@/pages/SuperAdmin'));
const Stock = React.lazy(() => import('@/pages/Stock'));
const Production = React.lazy(() => import('@/pages/Production'));
const Penerimaan = React.lazy(() => import('@/pages/Penerimaan'));
const AccurateSettings = React.lazy(() => import('@/pages/AccurateSettings'));
const KoliDetail = React.lazy(() => import('@/pages/KoliDetail'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const getRouteGroup = (pathname) => {
  if (["/login", "/register", "/forgot-password", "/reset-password", "/"].includes(pathname)) return "auth";
  if (pathname === "/super-admin") return "super-admin";
  if (pathname === "/accurate") return "accurate";
  return "app";
};

const AnimatedRoutes = ({ children }) => {
  const location = useLocation();
  const group = getRouteGroup(location.pathname);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={group} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2, ease: "easeInOut" }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <AnimatedRoutes>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Login />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<FeatureRoute featureKey="dashboard"><Dashboard /></FeatureRoute>} />
          <Route path="/pengiriman" element={<FeatureRoute featureKey="pengiriman"><Shipments /></FeatureRoute>} />
          <Route path="/admin" element={<FeatureRoute featureKey="master_data"><Admin /></FeatureRoute>} />
          <Route path="/produksi" element={<FeatureRoute featureKey="production"><Production /></FeatureRoute>} />
          <Route path="/penerimaan" element={<FeatureRoute featureKey="penerimaan"><Penerimaan /></FeatureRoute>} />
          <Route path="/report" element={<FeatureRoute featureKey="report"><Report /></FeatureRoute>} />
          <Route path="/stok" element={<FeatureRoute featureKey="stock"><Stock /></FeatureRoute>} />
          <Route path="/accurate" element={<FeatureRoute featureKey="master_data"><AccurateSettings /></FeatureRoute>} />
          <Route path="/super-admin" element={<FeatureRoute featureKey="super_admin"><SuperAdmin /></FeatureRoute>} />
          <Route path="/koli/:suffix/:koliNo" element={<KoliDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    </AnimatedRoutes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <SplashScreen />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App