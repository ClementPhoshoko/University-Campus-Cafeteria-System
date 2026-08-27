import {
  IconHome2,
  IconBuildingCommunity,
  IconReceipt2,
  IconUser,
  IconChefHat,
  IconSettings,
  IconBuilding,
  IconCreditCard,
  IconHeadset,
  IconFileText,
} from '@tabler/icons-react';

// Single source of truth for app navigation.
// `roles` is optional — if omitted the item is visible to everyone.
// Order determines display order in DesktopNav.
export const navigationItems = [
  // ── Core (everyone) ──
  { key: 'home', label: 'Home', route: '/', Icon: IconHome2 },
  { key: 'cafeterias', label: 'Cafeterias', route: '/cafeterias', Icon: IconBuildingCommunity },

  // ── Role-specific: ordering flow (before Orders) ──
  {
    key: 'catering',
    label: 'Catering',
    route: '/corporate',
    Icon: IconBuilding,
    roles: ['executive', 'executive_assistant', 'meeting_organiser'],
  },

  { key: 'orders', label: 'Orders', route: '/orders', Icon: IconReceipt2 },

  // ── Role-specific: operational dashboards (after Orders) ──
  {
    key: 'vendor',
    label: 'Vendor',
    route: '/vendor',
    Icon: IconChefHat,
    roles: ['vendor_staff', 'vendor_manager'],
  },
  {
    key: 'admin',
    label: 'Admin',
    route: '/admin',
    Icon: IconSettings,
    roles: ['admin'],
  },
  {
    key: 'finance',
    label: 'Finance',
    route: '/finance',
    Icon: IconCreditCard,
    roles: ['finance'],
  },
  {
    key: 'support',
    label: 'Support',
    route: '/support',
    Icon: IconHeadset,
    roles: ['support'],
  },
  {
    key: 'audit',
    label: 'Audit',
    route: '/audit',
    Icon: IconFileText,
    roles: ['auditor'],
  },

  // ── Core (always last) ──
  { key: 'profile', label: 'Profile', route: '/profile', Icon: IconUser },
];
