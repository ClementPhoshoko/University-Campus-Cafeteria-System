import { useState } from 'react';
import { IconLock, IconEye, IconEyeOff } from '@tabler/icons-react';

export default function PasswordInput({ label, error, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`auth-field ${error ? 'auth-field--error' : ''}`}>
      {label && <label className="auth-field__label">{label}</label>}
      <div className="auth-input-wrap">
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
      </div>
    </div>
  );
}
