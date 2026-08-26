import {
  IconHome2,
  IconBuildingCommunity,
  IconReceipt2,
  IconUser,
} from '@tabler/icons-react';

// Single source of truth for app navigation.
export const navigationItems = [
  { key: 'home', label: 'Home', route: '/', Icon: IconHome2 },
  { key: 'cafeterias', label: 'Cafeterias', route: '/cafeterias', Icon: IconBuildingCommunity },
  { key: 'orders', label: 'Orders', route: '/orders', Icon: IconReceipt2 },
  { key: 'profile', label: 'Profile', route: '/profile', Icon: IconUser },
];
