import {
  IconChartBar,
  IconChartPie,
  IconSettings,
  IconBuildingStore,
  IconUsers,
  IconReceipt,
  IconFileAnalytics,
  IconShieldCheck,
  IconAlertTriangle,
  IconSpeakerphone,
} from '@tabler/icons-react';

const icons = [
  { Icon: IconChartBar, className: 'admin-bg-icon admin-bg-icon--1' },
  { Icon: IconBuildingStore, className: 'admin-bg-icon admin-bg-icon--2' },
  { Icon: IconChartPie, className: 'admin-bg-icon admin-bg-icon--3' },
  { Icon: IconUsers, className: 'admin-bg-icon admin-bg-icon--4' },
  { Icon: IconReceipt, className: 'admin-bg-icon admin-bg-icon--5' },
  { Icon: IconFileAnalytics, className: 'admin-bg-icon admin-bg-icon--6' },
  { Icon: IconShieldCheck, className: 'admin-bg-icon admin-bg-icon--7' },
  { Icon: IconAlertTriangle, className: 'admin-bg-icon admin-bg-icon--8' },
  { Icon: IconSettings, className: 'admin-bg-icon admin-bg-icon--9' },
  { Icon: IconSpeakerphone, className: 'admin-bg-icon admin-bg-icon--10' },
];

export default function AdminBackground() {
  return (
    <div className="admin-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
