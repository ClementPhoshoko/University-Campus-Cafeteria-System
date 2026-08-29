import { IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import './BackButton.css';

export default function BackButton({ to, label, onClick, className = '' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      className={`back-button ${className}`}
      onClick={handleClick}
    >
      <IconArrowLeft size={18} stroke={1.8} />
      {label && <span>{label}</span>}
    </button>
  );
}
