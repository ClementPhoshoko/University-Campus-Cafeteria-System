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
import mainLogo from '../../assets/main_logo.jpeg';
import './splash.css';

const foodIcons = [
  { icon: IconPizza, size: 34, className: 'splash-icon-pos-tl' },
  { icon: IconSalad, size: 30, className: 'splash-icon-pos-tr' },
  { icon: IconBurger, size: 28, className: 'splash-icon-pos-ml' },
  { icon: IconCup, size: 26, className: 'splash-icon-pos-mr' },
  { icon: IconCoffee, size: 30, className: 'splash-icon-pos-bl' },
  { icon: IconToolsKitchen2, size: 28, className: 'splash-icon-pos-br' },
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
        </div>

        <div className="splash-brand">
          <img
            src={mainLogo}
            alt="CampusBites logo"
            className="splash-logo"
            draggable="false"
          />

          <h1 className="splash-name">CampusBites</h1>

          <p className="splash-tagline">
            Skip the queue. Enjoy your <span className="splash-tagline-accent">meal.</span>
          </p>

          <div className="splash-divider" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}