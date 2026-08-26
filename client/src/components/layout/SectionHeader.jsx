import { Link } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';

/**
 * Identifies a section within a page. Optional trailing action ("View all")
 * rendered as a high-visibility link with a leading chevron.
 */
export default function SectionHeader({ title, actionLabel, actionTo }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="section-link">
          <span>{actionLabel}</span>
          <IconChevronRight size={17} stroke={2.4} />
        </Link>
      )}
    </div>
  );
}
