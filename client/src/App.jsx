import { useState, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import SplashScreen from './features/auth/SplashScreen.jsx';
import Onboarding from './features/onboarding/Onboarding.jsx';
import AuthLayout from './components/AuthLayout.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import Login from './features/auth/Login.jsx';
import Signup from './features/auth/Signup.jsx';
import ForgotPassword from './features/auth/ForgotPassword.jsx';
import AuthCallback from './features/auth/AuthCallback.jsx';
import EmailConfirmation from './features/auth/EmailConfirmation.jsx';
import PasswordRecovery from './features/auth/PasswordRecovery.jsx';
import './features/auth/auth.css';

function isOnboardingCompleted(profile) {
  return profile?.notification_preferences?.onboarding_completed === true;
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
        <Route path="/" element={<main className="app-shell"><p>Home screen coming soon</p></main>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
