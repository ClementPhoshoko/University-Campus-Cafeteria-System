import { useState, useEffect, useCallback, useRef } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import './HeroFoodShowcase.css';

const ROTATE_MS = 4000;
const TRANSITION_MS = 600;

export default function HeroFoodShowcase({ items }) {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [direction, setDirection] = useState('next');
  const pausedRef = useRef(false);
  const timerRef = useRef(null);
  const resetTimerRef = useRef(null);

  const go = useCallback((dir) => {
    setDirection(dir);
    setPrevIndex((prev) => {
      const current = prev !== null ? index : index;
      return current;
    });
    setIndex((i) => {
      if (dir === 'next') return (i + 1) % items.length;
      return (i - 1 + items.length) % items.length;
    });

    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setPrevIndex(null);
    }, TRANSITION_MS + 50);
  }, [items.length, index]);

  const next = useCallback(() => go('next'), [go]);
  const prev = useCallback(() => go('prev'), [go]);

  useEffect(() => {
    const start = () => {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!pausedRef.current) next();
      }, ROTATE_MS);
    };
    start();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(resetTimerRef.current);
    };
  }, [next]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  const isExiting = (i) => prevIndex !== null && i === prevIndex && prevIndex !== index;
  const isActive = (i) => i === index;
  const isFromRight = direction === 'next';

  const slideClass = (i) => {
    if (isExiting(i)) {
      return `hero-showcase-slide hero-showcase-slide--exit-${isFromRight ? 'left' : 'right'}`;
    }
    if (isActive(i)) {
      return 'hero-showcase-slide hero-showcase-slide--active';
    }
    return `hero-showcase-slide hero-showcase-slide--from-${isFromRight ? 'right' : 'left'}`;
  };

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
          alt=""
          className={slideClass(i)}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      <button
        type="button"
        className="hero-showcase-nav hero-showcase-nav--prev"
        onClick={prev}
        aria-label="Previous"
      >
        <IconChevronLeft size={36} stroke={2.4} />
      </button>

      <button
        type="button"
        className="hero-showcase-nav hero-showcase-nav--next"
        onClick={next}
        aria-label="Next"
      >
        <IconChevronRight size={36} stroke={2.4} />
      </button>
    </div>
  );
}
