export function ProfileField({ label, value }) {
  return (
    <div className="profile_info-row">
      <dt className="profile_info-label">{label}</dt>
      <dd className="profile_info-value">{value || 'Not set'}</dd>
    </div>
  );
}

export function ProfileInput({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <label className="profile_input-field">
      <span className="profile_input-label">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
