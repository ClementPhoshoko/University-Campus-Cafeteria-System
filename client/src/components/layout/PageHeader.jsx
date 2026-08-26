/**
 * Identifies the current page: title (+optional eyebrow), subtitle and actions.
 * Distinct from ApplicationHeader (global) and SectionHeader (in-page).
 */
export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  const hasActions = Boolean(actions);
  return (
    <section className={`page-header${hasActions ? ' has-actions' : ''}`}>
      <div>
        <div className="page-header-heading">
          {eyebrow && <p className="page-header-eyebrow">{eyebrow}</p>}
          <h2 className="page-header-title">{title}</h2>
        </div>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {hasActions && <div className="page-header-actions">{actions}</div>}
    </section>
  );
}
