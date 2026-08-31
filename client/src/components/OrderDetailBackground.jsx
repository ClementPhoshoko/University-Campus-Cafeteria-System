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
} from '@tabler/icons-react';

const icons = [
  { Icon: IconCup, className: 'order-detail-bg-icon order-detail-bg-icon--1' },
  { Icon: IconCoffee, className: 'order-detail-bg-icon order-detail-bg-icon--2' },
  { Icon: IconSalad, className: 'order-detail-bg-icon order-detail-bg-icon--3' },
  { Icon: IconSoup, className: 'order-detail-bg-icon order-detail-bg-icon--4' },
  { Icon: IconMeat, className: 'order-detail-bg-icon order-detail-bg-icon--5' },
  { Icon: IconToolsKitchen2, className: 'order-detail-bg-icon order-detail-bg-icon--6' },
  { Icon: IconBottle, className: 'order-detail-bg-icon order-detail-bg-icon--7' },
  { Icon: IconGlass, className: 'order-detail-bg-icon order-detail-bg-icon--8' },
  { Icon: IconFish, className: 'order-detail-bg-icon order-detail-bg-icon--9' },
  { Icon: IconApple, className: 'order-detail-bg-icon order-detail-bg-icon--10' },
  { Icon: IconCookie, className: 'order-detail-bg-icon order-detail-bg-icon--11' },
  { Icon: IconIceCream, className: 'order-detail-bg-icon order-detail-bg-icon--12' },
];

export default function OrderDetailBackground() {
  return (
    <div className="order-detail-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
