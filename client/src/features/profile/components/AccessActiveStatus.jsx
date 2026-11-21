/** Active indicator rendered only when the caller confirms the item is active. */
export default function AccessActiveStatus({ active, label = 'Active' }) {
  if (!active) return null;
  return (
    <span className="access-active-status">
      <span className="access-active-status__dot" />
      {label}
    </span>
  );
}
