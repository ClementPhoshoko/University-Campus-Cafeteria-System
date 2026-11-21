export const PROFILE_SECTIONS = [
  {
    id: 'overview',
    route: '/profile/overview',
    title: 'Overview',
    subtitle: 'Personal & contact details',
    icon: 'user',
  },
  {
    id: 'access',
    route: '/profile/access',
    title: 'Role & access',
    subtitle: 'Assigned roles and vendor access',
    icon: 'shield',
  },
  {
    id: 'favourites',
    route: '/profile/favourites',
    title: 'Favourites',
    subtitle: 'Vendors & meals you love',
    icon: 'heart',
  },
  {
    id: 'preferences',
    route: '/profile/preferences',
    title: 'Preferences',
    subtitle: 'Dietary & notification settings',
    icon: 'settings',
  },
  {
    id: 'security',
    route: '/profile/security',
    title: 'Security',
    subtitle: 'Password & session management',
    icon: 'lock',
  },
];

export const PROFILE_INDEX_ROUTE = '/profile/overview';

export function activeProfileSection(pathname = '') {
  const match = PROFILE_SECTIONS.find((section) => (
    pathname === section.route || pathname.startsWith(`${section.route}/`)
  ));
  return match?.id ?? 'overview';
}
