import AccessActiveStatus from './AccessActiveStatus.jsx';

/**
 * Presentation-only role card. Roles, labels, icons and active state are all
 * supplied by the page from the canonical profile access response.
 */
export default function AccessRoleCard({
  title,
  description,
  icon: Icon,
  tone = 'blue',
  source,
  active,
}) {
  return (
    <article className={`access-role-card access-role-card--${tone}`}>
      <div className="access-role-card__top">
        <span className={`access-icon-badge access-icon-badge--${tone}`}>
          {Icon ? <Icon size={19} stroke={1.8} aria-hidden="true" /> : null}
        </span>
        <AccessActiveStatus active={active} />
      </div>
      <div className="access-role-card__body">
        <h4 className="access-role-card__title">{title}</h4>
        <p className="access-role-card__description">{description}</p>
      </div>
      {source && <span className="access-role-card__source">{source}</span>}
    </article>
  );
}
