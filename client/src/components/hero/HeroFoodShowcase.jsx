import { useState, useEffect, useCallback, useRef } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import './HeroFoodShowcase.css';

const ROTATE_MS = 4000;

export default function HeroFoodShowcase({ items }) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const timerRef = useRef(null);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    const start = () => {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!pausedRef.current) next();
      }, ROTATE_MS);
    };
    start();
    return () => clearInterval(timerRef.current);
  }, [next]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  const item = items[index];

  return (
    <div
      className="hero-showcase"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {items.map((m, i) => (
        <img
          key={m.id}
          src={m.image}
          alt={m.name}
          className="hero-showcase-slide"
          data-active={i === index}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      <button
        type="button"
        className="hero-showcase-nav hero-showcase-nav--prev"
        onClick={prev}
        aria-label="Previous food"
      >
        <IconChevronLeft size={20} stroke={2.2} />
      </button>

      <button
        type="button"
        className="hero-showcase-nav hero-showcase-nav--next"
        onClick={next}
        aria-label="Next food"
      >
        <IconChevronRight size={20} stroke={2.2} />
      </button>

      <div className="hero-showcase-info">
        <p className="hero-showcase-title">{item.name}</p>
        <span className="hero-showcase-price">{item.price}</span>
      </div>
    </div>
  );
}
