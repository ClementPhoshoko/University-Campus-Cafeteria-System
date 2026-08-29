import {
  IconToolsKitchen2,
  IconCup,
  IconCoffee,
  IconSalad,
  IconSoup,
  IconMeat,
  IconBottle,
  IconGlass,
  IconFish,
  IconApple,
  IconCookie,
  IconIceCream,
  IconCake,
} from '@tabler/icons-react';

const icons = [
  { Icon: IconCup, className: 'cart-bg-icon cart-bg-icon--1' },
  { Icon: IconCoffee, className: 'cart-bg-icon cart-bg-icon--2' },
  { Icon: IconSalad, className: 'cart-bg-icon cart-bg-icon--3' },
  { Icon: IconSoup, className: 'cart-bg-icon cart-bg-icon--4' },
  { Icon: IconMeat, className: 'cart-bg-icon cart-bg-icon--5' },
  { Icon: IconToolsKitchen2, className: 'cart-bg-icon cart-bg-icon--6' },
  { Icon: IconBottle, className: 'cart-bg-icon cart-bg-icon--7' },
  { Icon: IconGlass, className: 'cart-bg-icon cart-bg-icon--8' },
  { Icon: IconFish, className: 'cart-bg-icon cart-bg-icon--9' },
  { Icon: IconApple, className: 'cart-bg-icon cart-bg-icon--10' },
  { Icon: IconCookie, className: 'cart-bg-icon cart-bg-icon--11' },
  { Icon: IconIceCream, className: 'cart-bg-icon cart-bg-icon--12' },
  { Icon: IconCake, className: 'cart-bg-icon cart-bg-icon--13' },
];

export default function CartBackground() {
  return (
    <div className="cart-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
