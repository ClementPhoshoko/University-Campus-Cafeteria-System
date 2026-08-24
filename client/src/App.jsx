import { useState } from 'react';
import SplashScreen from './features/auth/SplashScreen.jsx';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <main className="app-shell">
      <p>Home screen coming soon</p>
    </main>
  );
}