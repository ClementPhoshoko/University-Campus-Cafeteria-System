import { useState, useMemo } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import SplashScreen from './features/auth/SplashScreen.jsx';
import Onboarding from './features/onboarding/Onboarding.jsx';
import AuthLayout from './components/AuthLayout.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import ApplicationHeader from './components/layout/ApplicationHeader.jsx';
import MobileBottomNav from './components/layout/MobileBottomNav.jsx';
import PageContainer from './components/layout/PageContainer.jsx';
import Login from './features/auth/Login.jsx';
import Signup from './features/auth/Signup.jsx';
import ForgotPassword from './features/auth/ForgotPassword.jsx';
import AuthCallback from './features/auth/AuthCallback.jsx';
import EmailConfirmation from './features/auth/EmailConfirmation.jsx';
import PasswordRecovery from './features/auth/PasswordRecovery.jsx';
import HomePage from './features/home/HomePage.jsx';
import ProfilePage from './features/profile/ProfilePage.jsx';
import './features/auth/auth.css';

function isOnboardingCompleted(profile) {
  return profile?.notification_preferences?.onboarding_completed === true;
}

/** Shared shell for authenticated pages: header + routed content + mobile nav. */
function AppLayout() {
  return (
    <div className="app-shell">
      <ApplicationHeader />
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <PageContainer>
      <h2 style={{ margin: 'var(--space-8) 0' }}>{title} — coming soon</h2>
    </PageContainer>
  );
}

export default function App() {
  const { user, profile, initialized } = useAuth();
  const [phase, setPhase] = useState('splash');

  const shouldShowOnboarding = useMemo(() => {
    if (!initialized) return false;
    if (phase !== 'home') return false;
    if (user && isOnboardingCompleted(profile)) return false;
    return true;
  }, [initialized, phase, user, profile]);

  if (phase === 'splash') {
    return <SplashScreen onComplete={() => setPhase('home')} />;
  }

  if (phase === 'home' && shouldShowOnboarding) {
    return <Onboarding onComplete={() => setPhase('app')} />;
  }

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
      </Route>

      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<EmailConfirmation />} />
      <Route path="/auth/recovery" element={<PasswordRecovery />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/cafeterias" element={<PlaceholderPage title="Cafeterias" />} />
          <Route path="/orders" element={<PlaceholderPage title="Orders" />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/corporate" element={<PlaceholderPage title="Corporate Catering" />} />
          <Route path="/vendor" element={<PlaceholderPage title="Vendor Dashboard" />} />
          <Route path="/admin" element={<PlaceholderPage title="Admin Panel" />} />
          <Route path="/finance" element={<PlaceholderPage title="Finance" />} />
          <Route path="/support" element={<PlaceholderPage title="Support Centre" />} />
          <Route path="/audit" element={<PlaceholderPage title="Audit Logs" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
