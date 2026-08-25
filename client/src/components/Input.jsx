import { useRef } from 'react';
import GlassTooltip from './GlassTooltip.jsx';

export default function Input({ label, icon: Icon, error, tooltipError, ...props }) {
  const wrapRef = useRef(null);

  return (
    <div className={`auth-field ${error ? 'auth-field--error' : ''}`}>
      {label && <label className="auth-field__label">{label}</label>}
      <div className="auth-input-wrap" ref={wrapRef} style={{ position: 'relative' }}>
        {Icon && <Icon size={18} stroke={2} className="auth-input-icon" />}
        <input className="auth-input" {...props} />
        {error && tooltipError && (
          <GlassTooltip message={error} type="error" anchorRef={wrapRef} position="top" />
        )}
      </div>
      {error && !tooltipError && <span className="auth-field__error">{error}</span>}
    </div>
  );
}
