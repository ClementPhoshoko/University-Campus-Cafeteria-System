export default function PrimaryButton({ children, icon: Icon, onClick, size = 'md', ...props }) {
  return (
    <button
      className={`primary-btn primary-btn--${size}`}
      onClick={onClick}
      type="button"
      {...props}
    >
      <span className="primary-btn__label">{children}</span>
      {Icon && <Icon size={16} stroke={2} className="primary-btn__icon" />}
    </button>
  );
}
