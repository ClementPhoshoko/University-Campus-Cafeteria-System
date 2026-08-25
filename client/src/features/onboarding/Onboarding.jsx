import { useState, useRef, useCallback, useEffect } from 'react';
import OnboardingSlide from './OnboardingSlide.jsx';
import OnboardingIndicator from './OnboardingIndicator.jsx';
import PrimaryButton from '../../components/PrimaryButton.jsx';
import { IconArrowRight, IconArrowLeft } from '@tabler/icons-react';
import onboardingSlides from './onboardingData.js';
import './onboarding.css';

const SWIPE_THRESHOLD = 50;

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef(null);
  const touchDelta = useRef(0);
  const isDragging = useRef(false);

  const isLast = current === onboardingSlides.length - 1;
  const total = onboardingSlides.length;

  const goNext = useCallback(() => {
    if (isLast) {
      localStorage.setItem('onboarding_completed', 'true');
      onComplete?.();
    } else {
      setCurrent((prev) => prev + 1);
    }
  }, [isLast, onComplete]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current || touchStart.current === null) return;
    touchDelta.current = e.touches[0].clientX - touchStart.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (touchDelta.current < -SWIPE_THRESHOLD) {
      goNext();
    } else if (touchDelta.current > SWIPE_THRESHOLD) {
      goPrev();
    }

    touchStart.current = null;
    touchDelta.current = 0;
  }, [goNext, goPrev]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  return (
    <div
      className="onboarding-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="onboarding-track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {onboardingSlides.map((slide) => (
          <div className="onboarding-track-slide" key={slide.id}>
            <OnboardingSlide slide={slide} />
          </div>
        ))}
      </div>

      <div className="onboarding-controls">
        <div className="onboarding-actions">
          {current > 0 && (
            <PrimaryButton
              icon={IconArrowLeft}
              onClick={goPrev}
              size="sm"
            >
              Back
            </PrimaryButton>
          )}
          <PrimaryButton
            icon={isLast ? undefined : IconArrowRight}
            onClick={goNext}
            size="sm"
          >
            {isLast ? 'Get started' : 'Next'}
          </PrimaryButton>
        </div>

        <OnboardingIndicator total={total} current={current} />
      </div>
    </div>
  );
}