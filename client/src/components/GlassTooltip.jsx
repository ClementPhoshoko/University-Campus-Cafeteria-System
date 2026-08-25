import { useState, useEffect, useRef, useCallback } from 'react';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconX } from '@tabler/icons-react';
import './GlassTooltip.css';

const ICONS = {
  error: IconAlertTriangle,
  warning: IconAlertCircle,
  info: IconInfoCircle,
};

export default function GlassTooltip({
  message,
  type = 'error',
  onClose,
  autoClose = true,
  autoCloseDelay = 4000,
  banner = false,
}) {
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const tooltipRef = useRef(null);

  const handleClose = useCallback(() => {
    if (closing) return;
    clearTimeout(timerRef.current);
    // Force layout so browser paints the current state before transition
    tooltipRef.current?.offsetHeight;
    setClosing(true);
    setTimeout(() => {
      if (mountedRef.current) {
        setShow(false);
        setClosing(false);
        onClose?.();
      }
    }, 220);
  }, [closing, onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (message) {
      setShow(true);
      setClosing(false);

      if (autoClose && autoCloseDelay > 0) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(handleClose, autoCloseDelay);
      }
    } else {
      setShow(false);
      setClosing(false);
    }

    return () => clearTimeout(timerRef.current);
  }, [message, autoClose, autoCloseDelay, handleClose]);

  if (!show) return null;

  const Icon = ICONS[type];
  const bannerClass = banner ? 'glass-tooltip--banner' : '';

  return (
    <div
      ref={tooltipRef}
      className={`glass-tooltip glass-tooltip--${type} ${closing ? 'glass-tooltip--exit' : ''} ${bannerClass}`}
      role="alert"
    >
      {!banner && <span className="glass-tooltip__arrow" />}
      {Icon && <Icon size={14} stroke={2} className="glass-tooltip__icon" />}
      <span className="glass-tooltip__message">{message}</span>
      <button
        type="button"
        className="glass-tooltip__close"
        onClick={handleClose}
        aria-label="Dismiss"
      >
        <IconX size={12} stroke={2} />
      </button>
      {autoClose && autoCloseDelay > 0 && (
        <span
          className={`glass-tooltip__progress ${closing ? 'glass-tooltip__progress--hidden' : ''}`}
          style={{ animationDuration: `${autoCloseDelay}ms` }}
        />
      )}
    </div>
  );
}
