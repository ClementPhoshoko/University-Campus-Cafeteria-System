import { useState } from 'react';
import SplashScreen from './features/auth/SplashScreen.jsx';
import Onboarding from './features/onboarding/Onboarding.jsx';

export default function App() {
  const [phase, setPhase] = useState('splash');

  if (phase === 'splash') {
    return <SplashScreen onComplete={() => setPhase('onboarding')} />;
  }

  if (phase === 'onboarding') {
    return <Onboarding onComplete={() => setPhase('home')} />;
  }

  return (
    <main className="app-shell">
      <p>Home screen coming soon</p>
    </main>
  );
}