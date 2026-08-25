import {
  IconPizza,
  IconSalad,
  IconBurger,
  IconCoffee,
  IconCup,
  IconToolsKitchen2,
  IconSoup,
  IconMeat,
  IconApple,
  IconCake,
  IconEgg,
  IconBeer,
} from '@tabler/icons-react';
import authWave from '../features/auth/auth_bottom_wave.svg';

const icons = [
  { Icon: IconPizza, className: 'auth-bg-icon auth-bg-icon--1' },
  { Icon: IconSalad, className: 'auth-bg-icon auth-bg-icon--2' },
  { Icon: IconBurger, className: 'auth-bg-icon auth-bg-icon--3' },
  { Icon: IconCoffee, className: 'auth-bg-icon auth-bg-icon--4' },
  { Icon: IconCup, className: 'auth-bg-icon auth-bg-icon--5' },
  { Icon: IconToolsKitchen2, className: 'auth-bg-icon auth-bg-icon--6' },
  { Icon: IconSoup, className: 'auth-bg-icon auth-bg-icon--7' },
  { Icon: IconMeat, className: 'auth-bg-icon auth-bg-icon--8' },
  { Icon: IconApple, className: 'auth-bg-icon auth-bg-icon--9' },
  { Icon: IconCake, className: 'auth-bg-icon auth-bg-icon--10' },
  { Icon: IconEgg, className: 'auth-bg-icon auth-bg-icon--11' },
  { Icon: IconBeer, className: 'auth-bg-icon auth-bg-icon--12' },
];

export default function AuthBackground() {
  return (
    <div className="auth-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
      <img src={authWave} className="auth-bg-wave" alt="" />
    </div>
  );
}
