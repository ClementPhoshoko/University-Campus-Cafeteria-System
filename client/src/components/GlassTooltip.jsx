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
  const [state, setState] = useState('enter'); // 'enter' | 'idle' | 'exit'
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const handleClose = useCallback(() => {
    if (state === 'exit') return;
    clearTimeout(timerRef.current);
    setState('exit');
    setTimeout(() => {
      if (mountedRef.current) {
        onClose?.();
      }
    }, 220);
  }, [state, onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (message) {
      setState('enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setState('idle');
        });
      });

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
  }, [state, anchorRef, position]);

  if (!message) return null;

  const Icon = ICONS[type];
  const stateClass = state === 'enter' ? 'glass-tooltip--enter' : state === 'exit' ? 'glass-tooltip--exit' : '';

  return (
    <div
      ref={tooltipRef}
      className={`glass-tooltip glass-tooltip--${type} glass-tooltip--${actualPosition} ${stateClass}`}
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
      {autoClose && autoCloseDelay > 0 && state === 'idle' && (
        <span
          className="glass-tooltip__progress"
          style={{ animationDuration: `${autoCloseDelay}ms` }}
        />
      )}
    </div>
  );
}
