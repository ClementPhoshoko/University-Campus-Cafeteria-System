import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  const [phase, setPhase] = useState('splash');

  if (phase === 'splash') {
    return <SplashScreen onComplete={() => setPhase('onboarding')} />;
  }

  if (phase === 'onboarding') {
    return <Onboarding onComplete={() => setPhase('home')} />;
  }

  return (
    <Routes>
      {/* Public auth routes - only accessible when not logged in */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
      </Route>

      {/* Callback routes - no layout needed */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<EmailConfirmation />} />
      <Route path="/auth/recovery" element={<PasswordRecovery />} />

      {/* Protected routes - requires authentication */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<main className="app-shell"><p>Home screen coming soon</p></main>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
