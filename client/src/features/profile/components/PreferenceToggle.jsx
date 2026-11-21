export default function PreferenceToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <label className="profile_toggle">
      <span className="profile_toggle-text">
        <span className="profile_toggle-label">{label}</span>
        <span className="profile_toggle-desc">{description}</span>
      </span>
      <input
        type="checkbox"
        className="profile_toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
