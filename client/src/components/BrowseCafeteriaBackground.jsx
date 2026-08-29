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
} from '@tabler/icons-react';

const icons = [
  { Icon: IconCup, className: 'browse-bg-icon browse-bg-icon--1' },
  { Icon: IconCoffee, className: 'browse-bg-icon browse-bg-icon--2' },
  { Icon: IconSalad, className: 'browse-bg-icon browse-bg-icon--3' },
  { Icon: IconSoup, className: 'browse-bg-icon browse-bg-icon--4' },
  { Icon: IconMeat, className: 'browse-bg-icon browse-bg-icon--5' },
  { Icon: IconToolsKitchen2, className: 'browse-bg-icon browse-bg-icon--6' },
  { Icon: IconBottle, className: 'browse-bg-icon browse-bg-icon--7' },
  { Icon: IconGlass, className: 'browse-bg-icon browse-bg-icon--8' },
  { Icon: IconFish, className: 'browse-bg-icon browse-bg-icon--9' },
  { Icon: IconApple, className: 'browse-bg-icon browse-bg-icon--10' },
];

export default function BrowseCafeteriaBackground() {
  return (
    <div className="browse-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
