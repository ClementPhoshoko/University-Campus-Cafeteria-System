import { IconArrowRight } from '@tabler/icons-react';

export default function OnboardingButton({ children, onClick, isLast }) {
  return (
    <button
      className="onboarding-btn"
      onClick={onClick}
      type="button"
    >
      <span className="onboarding-btn-label">{children}</span>
      <IconArrowRight size={20} stroke={2} className="onboarding-btn-icon" />
    </button>
  );
}