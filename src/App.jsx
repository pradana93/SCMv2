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
import { pageLoaders, preloadAllRoutesWhenIdle } from '@/lib/routePreload';

const Dashboard = React.lazy(pageLoaders['/dashboard']);
const Shipments = React.lazy(pageLoaders['/pengiriman']);
const Admin = React.lazy(pageLoaders['/admin']);
const Report = React.lazy(pageLoaders['/report']);
const SuperAdmin = React.lazy(pageLoaders['/super-admin']);
const Stock = React.lazy(pageLoaders['/stok']);
const Production = React.lazy(pageLoaders['/produksi']);
const Penerimaan = React.lazy(pageLoaders['/penerimaan']);
const AccurateSettings = React.lazy(pageLoaders['/accurate']);
const KoliDetail = React.lazy(pageLoaders['/koli']);

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

const ConfigErrorScreen = ({ message }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <h1 className="text-xl font-bold text-white">Backend belum dikonfigurasi</h1>
      <p className="mt-2 text-sm text-slate-400">
        {message || 'Supabase is not configured.'} Set{' '}
        <code className="rounded bg-slate-800 px-1 text-slate-200">VITE_SUPABASE_URL</code> dan{' '}
        <code className="rounded bg-slate-800 px-1 text-slate-200">VITE_SUPABASE_ANON_KEY</code>{' '}
        di Vercel (Project Settings &gt; Environment Variables), lalu redeploy.
      </p>
    </div>
  </div>
);

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
    if (authError.type === 'config_error') {
      return <ConfigErrorScreen message={authError.message} />;
    } else if (authError.type === 'user_not_registered') {
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

  // Warm all tab chunks when the browser is idle so switching tabs never
  // suspends into the full-screen loader.
  React.useEffect(() => {
    preloadAllRoutesWhenIdle();
  }, []);

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