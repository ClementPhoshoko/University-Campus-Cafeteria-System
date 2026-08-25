export default function SplashFoodIcon({ icon: Icon, size = 32, className = '', style = {} }) {
  return (
    <span
      className={`splash-food-icon ${className}`}
      aria-hidden="true"
      style={style}
    >
      <Icon size={size} stroke={1.5} />
    </span>
  );
}