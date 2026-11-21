import { IconBuildingStore } from '@tabler/icons-react';
import AccessActiveStatus from './AccessActiveStatus.jsx';

/** Full-width vendor association card. Vendor identity always leads. */
export default function VendorMembershipCard({ membership }) {
  const vendorName = typeof membership?.vendorName === 'string'
    ? membership.vendorName.trim()
    : '';

  return (
    <article className="access-membership-card">
      <span className="access-icon-badge access-icon-badge--purple">
        <IconBuildingStore size={19} stroke={1.8} aria-hidden="true" />
      </span>
      <div className="access-membership-card__body">
        <span className="access-membership-card__role">{membership?.roleLabel}</span>
        <span className="access-membership-card__vendor">{vendorName || 'Vendor'}</span>
      </div>
      <AccessActiveStatus active={membership?.is_active !== false} />
    </article>
  );
}
