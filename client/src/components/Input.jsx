export default function Input({ label, icon: Icon, error, ...props }) {
  return (
    <div className={`auth-field ${error ? 'auth-field--error' : ''}`}>
      {label && <label className="auth-field__label">{label}</label>}
      <div className="auth-input-wrap">
        {Icon && <Icon size={18} stroke={2} className="auth-input-icon" />}
        <input className="auth-input" {...props} />
      </div>
      {error && <span className="auth-field__error">{error}</span>}
    </div>
  );
}
