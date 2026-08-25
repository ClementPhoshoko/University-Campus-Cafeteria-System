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
  anchorRef,
  position = 'top',
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef(null);
  const timerRef = useRef(null);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 220);
  }, [closing, onClose]);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setClosing(false);

      if (autoClose && autoCloseDelay > 0) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(handleClose, autoCloseDelay);
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [message, autoClose, autoCloseDelay, handleClose]);

  useEffect(() => {
    if (!tooltipRef.current || !anchorRef?.current) return;

    const tooltip = tooltipRef.current;
    const anchor = anchorRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const viewportH = window.innerHeight;

    let preferred = position;

    if (preferred === 'top' && anchorRect.top - tooltipRect.height - 8 < 0) {
      preferred = 'bottom';
    } else if (preferred === 'bottom' && anchorRect.bottom + tooltipRect.height + 8 > viewportH) {
      preferred = 'top';
    }

    setActualPosition(preferred);
  }, [visible, anchorRef, position]);

  if (!visible || !message) return null;

  const Icon = ICONS[type];

  return (
    <div
      ref={tooltipRef}
      className={`glass-tooltip glass-tooltip--${type} glass-tooltip--${actualPosition} ${closing ? 'glass-tooltip--closing' : ''}`}
      role="alert"
    >
      <span className="glass-tooltip__arrow" />
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
          className="glass-tooltip__progress"
          style={{ animationDuration: `${autoCloseDelay}ms` }}
        />
      )}
    </div>
  );
}
