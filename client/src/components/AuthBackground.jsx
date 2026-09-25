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
      <svg className="auth-bg-wave" viewBox="0 0 1200 500" fill="none" aria-hidden="true">
        <path
          d="M0 155 C135 245 245 275 390 258 C535 241 625 155 770 145 C925 134 1040 205 1200 305 L1200 500 L0 500 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
