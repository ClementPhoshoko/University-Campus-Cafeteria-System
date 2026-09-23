import { useEffect, useRef, useState } from 'react';

const DEFAULT_MESSAGES = [
  'Processing your request...',
  'Updating records...',
  'Saving your changes...',
  'Almost there...',
];

export default function ModalProgressOverlay({ active = false, messages = DEFAULT_MESSAGES }) {
  const [loadMsg, setLoadMsg] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) { setLoadMsg(0); return; }
    timerRef.current = setInterval(() => setLoadMsg((i) => (i + 1) % messages.length), 1800);
    return () => clearInterval(timerRef.current);
  }, [active, messages]);

  if (!active) return null;

  return (
    <div className="vendor-creating-overlay">
      <div className="vendor-creating-card">
        <div className="vendor-creating-spinner" />
        <p className="vendor-creating-msg">{messages[loadMsg]}</p>
        <div className="vendor-creating-bar"><div className="vendor-creating-bar__fill" /></div>
        <p className="vendor-creating-hint">Hang tight, this won't take long.</p>
      </div>
    </div>
  );
}