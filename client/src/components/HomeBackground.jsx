import {
  IconSalad, IconSoup, IconMeat, IconEgg,
  IconPizza, IconBurger, IconChefHat, IconCoffee,
} from '@tabler/icons-react';

const icons = [
  { Icon: IconSalad,    className: 'home-bg-icon home-bg-icon--1' },
  { Icon: IconSoup,     className: 'home-bg-icon home-bg-icon--2' },
  { Icon: IconMeat,     className: 'home-bg-icon home-bg-icon--3' },
  { Icon: IconEgg,      className: 'home-bg-icon home-bg-icon--4' },
  { Icon: IconPizza,    className: 'home-bg-icon home-bg-icon--5' },
  { Icon: IconBurger,   className: 'home-bg-icon home-bg-icon--6' },
  { Icon: IconChefHat,  className: 'home-bg-icon home-bg-icon--7' },
  { Icon: IconCoffee,   className: 'home-bg-icon home-bg-icon--8' },
];

export default function HomeBackground() {
  return (
    <div className="home-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
