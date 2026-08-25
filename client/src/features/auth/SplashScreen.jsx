import { useState, useEffect } from 'react';
import {
  IconPizza,
  IconBurger,
  IconSalad,
  IconCup,
  IconCoffee,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import SplashFoodIcon from './SplashFoodIcon.jsx';
import mainLogo from '../../assets/main_logo.png';
import './splash.css';

const foodIcons = [
  { icon: IconPizza, size: 48, className: 'splash-icon-pos-tl' },
  { icon: IconSalad, size: 44, className: 'splash-icon-pos-tr' },
  { icon: IconBurger, size: 42, className: 'splash-icon-pos-ml' },
  { icon: IconCup, size: 40, className: 'splash-icon-pos-mr' },
  { icon: IconCoffee, size: 44, className: 'splash-icon-pos-bl' },
  { icon: IconToolsKitchen2, size: 42, className: 'splash-icon-pos-br' },
];

const circles = [
  { size: 8, className: 'splash-circle-1' },
  { size: 6, className: 'splash-circle-2' },
  { size: 10, className: 'splash-circle-3' },
  { size: 5, className: 'splash-circle-4' },
  { size: 7, className: 'splash-circle-5' },
  { size: 9, className: 'splash-circle-6' },
  { size: 4, className: 'splash-circle-7' },
  { size: 6, className: 'splash-circle-8' },
];

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible && onComplete) {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [visible, onComplete]);

  return (
    <div className={`splash-screen ${!visible ? 'splash-fade-out' : ''}`}>
      <div className="splash-content">
        <div className="splash-decorations">
          {foodIcons.map((item, i) => (
            <SplashFoodIcon
              key={i}
              icon={item.icon}
              size={item.size}
              className={item.className}
            />
          ))}
          {circles.map((item, i) => (
            <span
              key={`c-${i}`}
              className={`splash-circle ${item.className}`}
              style={{ width: item.size, height: item.size }}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="splash-brand">
          <img
            src={mainLogo}
            alt="Merchant Munchies logo"
            className="splash-logo"
            draggable="false"
          />

          <h1 className="splash-name">
            <span className="splash-name-merchant">merchant</span>
            <span className="splash-name-munchies">munchies</span>
          </h1>

          <p className="splash-tagline">
            <span>GOOD FOOD</span>
            <span className="splash-tagline-dot">•</span>
            <span className="splash-tagline-accent">LESS QUEUE</span>
            <span className="splash-tagline-dot">•</span>
            <span>MORE YOU</span>
          </p>

          <svg
            className="splash-smile"
            width="48"
            height="16"
            viewBox="0 0 48 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 4C12 14 36 14 44 4"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}