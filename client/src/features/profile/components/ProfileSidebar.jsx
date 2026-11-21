import { useLocation } from 'react-router-dom';
import {
  IconUser,
  IconShield,
  IconHeart,
  IconSettings,
  IconLock,
} from '@tabler/icons-react';
import MainSidebar from '../../../components/layout/MainSidebar.jsx';
import { PROFILE_SECTIONS, activeProfileSection } from '../profileNavigation.js';

const ICONS = {
  user: IconUser,
  shield: IconShield,
  heart: IconHeart,
  settings: IconSettings,
  lock: IconLock,
};

export default function ProfileSidebar() {
  const { pathname } = useLocation();
  const items = PROFILE_SECTIONS.map(({ id, route, title, subtitle, icon }) => ({
    id,
    to: route,
    title,
    subtitle,
    Icon: ICONS[icon] || IconUser,
  }));

  return (
    <MainSidebar items={items} active={activeProfileSection(pathname)} heading="Account" />
  );
}
