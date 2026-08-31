import {
  IconApple,
  IconBanana,
  IconCherry,
  IconCoffee,
  IconCookie,
  IconCup,
  IconGlass,
  IconIceCream,
  IconMeat,
  IconPizza,
} from '@tabler/icons-react';

const icons = [
  { Icon: IconApple, className: 'orders-bg-icon orders-bg-icon--1' },
  { Icon: IconCoffee, className: 'orders-bg-icon orders-bg-icon--2' },
  { Icon: IconCherry, className: 'orders-bg-icon orders-bg-icon--3' },
  { Icon: IconCup, className: 'orders-bg-icon orders-bg-icon--4' },
  { Icon: IconMeat, className: 'orders-bg-icon orders-bg-icon--5' },
  { Icon: IconCookie, className: 'orders-bg-icon orders-bg-icon--6' },
  { Icon: IconGlass, className: 'orders-bg-icon orders-bg-icon--7' },
  { Icon: IconIceCream, className: 'orders-bg-icon orders-bg-icon--8' },
  { Icon: IconPizza, className: 'orders-bg-icon orders-bg-icon--9' },
  { Icon: IconBanana, className: 'orders-bg-icon orders-bg-icon--10' },
];

export default function OrdersBackground() {
  return (
    <div className="orders-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
