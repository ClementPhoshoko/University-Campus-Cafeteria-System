import { useNavigate } from 'react-router-dom';
import { IconArrowRight } from '@tabler/icons-react';
import PrimaryButton from '../PrimaryButton.jsx';
import illustration from '../../assets/avatars/Disappointed_Student_with_Error_Icon.webp';

export default function OrderEmptyState({
  title = 'No orders yet',
  text = 'Start your first order from one of our campus cafeterias.',
  showBrowseButton = true,
}) {
  const navigate = useNavigate();

  return (
    <div className="orders-empty">
      <img src={illustration} alt="" className="orders-empty__avatar" loading="eager" />
      <h2 className="orders-empty__title">{title}</h2>
      <p className="orders-empty__text">{text}</p>
      {showBrowseButton && (
        <div className="orders-empty__btn">
          <PrimaryButton icon={IconArrowRight} onClick={() => navigate('/cafeterias')}>
            Browse Cafeterias
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
