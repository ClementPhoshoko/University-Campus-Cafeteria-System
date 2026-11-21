/** Quiet empty state shared by the Role & access sections. */
export default function AccessEmptyState({ icon: Icon, title, description }) {
  return (
    <div className="access-empty-state">
      <span className="access-empty-state__icon">
        {Icon ? <Icon size={18} stroke={1.8} aria-hidden="true" /> : null}
      </span>
      <div>
        <h4 className="access-empty-state__title">{title}</h4>
        <p className="access-empty-state__description">{description}</p>
      </div>
    </div>
  );
}
