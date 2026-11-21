/**
 * Shared heading for the Role & access sections.
 * The icon is supplied by the caller so platform and vendor contexts stay distinct.
 */
export default function AccessSectionHeader({
  icon: Icon,
  tone = 'blue',
  title,
  description,
  headingId,
}) {
  return (
    <header className="access-section-heading">
      <span className={`access-section-heading__icon access-section-heading__icon--${tone}`}>
        {Icon ? <Icon size={19} stroke={1.8} aria-hidden="true" /> : null}
      </span>
      <div className="access-section-heading__copy">
        <h3 id={headingId} className="access-section-heading__title">{title}</h3>
        {description && (
          <p className="access-section-heading__description">{description}</p>
        )}
      </div>
    </header>
  );
}
