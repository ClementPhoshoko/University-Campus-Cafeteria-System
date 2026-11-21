import { useEffect, useState } from 'react';

const DEFAULT_MESSAGES = [
  'Updating your inbox...',
  'Applying your change...',
  'Almost there...',
];

/**
 * Notification-scoped version of the vendor modal progress overlay. It uses the
 * same spinner/progress treatment without depending on admin-only CSS.
 */
export default function NotificationProgressOverlay({ active = false, messages = DEFAULT_MESSAGES }) {
  const [loadMsg, setLoadMsg] = useState(0);

  useEffect(() => {
    if (!active) {
      setLoadMsg(0);
      return undefined;
    }
    const timer = window.setInterval(
      () => setLoadMsg((index) => (index + 1) % messages.length),
      1800,
    );
    return () => window.clearInterval(timer);
  }, [active, messages]);

  if (!active) return null;

  return (
    <div className="notification-busy-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="notification-busy-card">
        <div className="notification-busy-spinner" />
        <p className="notification-busy-msg">{messages[loadMsg] || messages[0]}</p>
        <div className="notification-busy-bar"><div className="notification-busy-bar__fill" /></div>
        <p className="notification-busy-hint">Hang tight, this won't take long.</p>
      </div>
    </div>
  );
}
