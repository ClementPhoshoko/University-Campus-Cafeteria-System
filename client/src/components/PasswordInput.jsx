import { useState, useRef } from 'react';
import { IconLock, IconEye, IconEyeOff } from '@tabler/icons-react';
import GlassTooltip from './GlassTooltip.jsx';

export default function PasswordInput({ label, error, tooltipError, ...props }) {
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef(null);

  return (
    <div className={`auth-field ${error ? 'auth-field--error' : ''}`}>
      {label && <label className="auth-field__label">{label}</label>}
      <div className="auth-input-wrap" ref={wrapRef} style={{ position: 'relative' }}>
        <IconLock size={18} stroke={2} className="auth-input-icon" />
        <input
          className="auth-input"
          type={visible ? 'text' : 'password'}
          {...props}
        />
        <button
          type="button"
          className="auth-input-toggle"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible
            ? <IconEyeOff size={18} stroke={2} />
            : <IconEye size={18} stroke={2} />}
        </button>
        {error && tooltipError && (
          <GlassTooltip message={error} type="error" anchorRef={wrapRef} position="top" />
        )}
      </div>
      {error && !tooltipError && <span className="auth-field__error">{error}</span>}
    </div>
  );
}
