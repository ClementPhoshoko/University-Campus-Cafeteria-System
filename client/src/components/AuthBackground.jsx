import {
  IconPizza,
  IconSalad,
  IconBurger,
  IconCoffee,
  IconCup,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import authWave from '../features/auth/auth_bottom_wave.svg';

const icons = [
  { Icon: IconPizza, className: 'auth-bg-icon auth-bg-icon--1' },
  { Icon: IconSalad, className: 'auth-bg-icon auth-bg-icon--2' },
  { Icon: IconBurger, className: 'auth-bg-icon auth-bg-icon--3' },
  { Icon: IconCoffee, className: 'auth-bg-icon auth-bg-icon--4' },
  { Icon: IconCup, className: 'auth-bg-icon auth-bg-icon--5' },
  { Icon: IconToolsKitchen2, className: 'auth-bg-icon auth-bg-icon--6' },
];

export default function AuthBackground() {
  return (
    <div className="auth-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} size={28} stroke={1.5} className={className} />
      ))}
      <img src={authWave} className="auth-bg-wave" alt="" />
    </div>
  );
}
