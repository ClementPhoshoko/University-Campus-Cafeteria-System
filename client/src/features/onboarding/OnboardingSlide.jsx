import OnboardingIllustration from './OnboardingIllustration.jsx';

export default function OnboardingSlide({ slide }) {
  return (
    <div className="onboarding-slide">
      <OnboardingIllustration src={slide.illustration} alt={slide.title} />

      <div className="onboarding-content">
        <h2 className="onboarding-title">{slide.title}</h2>
        <p className="onboarding-description">{slide.description}</p>
      </div>
    </div>
  );
}