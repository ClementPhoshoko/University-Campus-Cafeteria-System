import { useRef, useCallback } from 'react';

const LENGTH = 6;

export default function OtpInput({ value, onChange, error }) {
  const inputs = useRef([]);

  const focus = useCallback((idx) => {
    inputs.current[idx]?.focus();
  }, []);

  const handleChange = (idx, digit) => {
    if (!/^\d*$/.test(digit)) return;

    const next = value.split('');
    next[idx] = digit;
    const joined = next.join('').slice(0, LENGTH);
    onChange(joined);

    if (digit && idx < LENGTH - 1) {
      focus(idx + 1);
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      const next = value.split('');
      next[idx - 1] = '';
      onChange(next.join(''));
      focus(idx - 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (text) {
      onChange(text);
      focus(Math.min(text.length, LENGTH - 1));
    }
  };

  const digits = value.split('').concat(Array(LENGTH - value.length).fill(''));

  return (
    <div className="otp-field">
      <label className="auth-field__label">Enter verification code</label>
      <div className="otp-input-group" onPaste={handlePaste}>
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => { inputs.current[idx] = el; }}
            className={`otp-input ${digit ? 'otp-input--filled' : ''} ${error ? 'otp-input--error' : ''}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onFocus={(e) => e.target.select()}
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          />
        ))}
      </div>
      {error && <span className="auth-field__error">{error}</span>}
    </div>
  );
}
