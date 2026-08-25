import {
  IconPizza,
  IconSalad,
  IconBurger,
  IconCoffee,
  IconCup,
  IconToolsKitchen2,
} from '@tabler/icons-react';

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
      <div className="auth-bg__surface auth-bg__surface--top" />
      <div className="auth-bg__surface auth-bg__surface--bottom" />
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} size={32} stroke={1.5} className={className} />
      ))}
      <div className="auth-bg__wave" />
    </div>
  );
}
