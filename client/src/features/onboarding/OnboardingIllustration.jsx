export default function OnboardingIllustration({ src, alt }) {
  return (
    <div className="onboarding-illustration">
      <img src={src} alt={alt} draggable="false" />
    </div>
  );
}