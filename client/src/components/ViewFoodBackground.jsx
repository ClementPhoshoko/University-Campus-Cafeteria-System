import {
  IconToolsKitchen2,
  IconCup,
  IconCoffee,
  IconSalad,
  IconSoup,
  IconMeat,
} from '@tabler/icons-react';

const icons = [
  { Icon: IconCup, className: 'view-food-bg-icon view-food-bg-icon--1' },
  { Icon: IconCoffee, className: 'view-food-bg-icon view-food-bg-icon--2' },
  { Icon: IconSalad, className: 'view-food-bg-icon view-food-bg-icon--3' },
  { Icon: IconSoup, className: 'view-food-bg-icon view-food-bg-icon--4' },
  { Icon: IconMeat, className: 'view-food-bg-icon view-food-bg-icon--5' },
  { Icon: IconToolsKitchen2, className: 'view-food-bg-icon view-food-bg-icon--6' },
];

export default function ViewFoodBackground() {
  return (
    <div className="view-food-bg" aria-hidden="true">
      {icons.map(({ Icon, className }, i) => (
        <Icon key={i} className={className} />
      ))}
    </div>
  );
}
