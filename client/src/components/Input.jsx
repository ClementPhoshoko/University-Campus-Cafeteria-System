import { useRef } from 'react';
import GlassTooltip from './GlassTooltip.jsx';

export default function Input({ label, icon: Icon, error, tooltipError, ...props }) {
  const fieldRef = useRef(null);

  return (
    <div className={`auth-field ${error ? 'auth-field--error' : ''}`} ref={fieldRef} style={{ position: 'relative' }}>
      {label && <label className="auth-field__label">{label}</label>}
      <div className="auth-input-wrap">
        {Icon && <Icon size={18} stroke={2} className="auth-input-icon" />}
        <input className="auth-input" {...props} />
      </div>
      {error && tooltipError && (
        <GlassTooltip message={error} type="error" anchorRef={fieldRef} position="top" />
      )}
      {error && !tooltipError && <span className="auth-field__error">{error}</span>}
    </div>
  );
}
