export default function OnboardingIndicator({ total, current }) {
  return (
    <div className="onboarding-indicator" role="tablist" aria-label="Onboarding progress">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`onboarding-dot ${i === current ? 'onboarding-dot-active' : ''}`}
          role="tab"
          aria-selected={i === current}
          aria-label={`Slide ${i + 1} of ${total}`}
        />
      ))}
    </div>
  );
}