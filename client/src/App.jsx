import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './features/auth/SplashScreen.jsx';
import Onboarding from './features/onboarding/Onboarding.jsx';
import AuthLayout from './components/AuthLayout.jsx';
import Login from './features/auth/Login.jsx';
import Signup from './features/auth/Signup.jsx';
import ForgotPassword from './features/auth/ForgotPassword.jsx';
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
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/" element={<main className="app-shell"><p>Home screen coming soon</p></main>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
