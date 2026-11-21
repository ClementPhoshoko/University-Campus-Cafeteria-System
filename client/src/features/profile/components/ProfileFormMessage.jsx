export default function ProfileFormMessage({ error, success }) {
  if (error) return <p className="profile_form-message profile_form-message--error" role="alert">{error}</p>;
  if (success) return <p className="profile_form-message profile_form-message--success" role="status">{success}</p>;
  return null;
}
