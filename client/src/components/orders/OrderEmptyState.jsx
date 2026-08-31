import { useNavigate } from 'react-router-dom';
import illustration from '../../assets/avatars/illustration_collect_order.png';

export default function OrderEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="orders-empty">
      <img src={illustration} alt="" className="orders-empty__image" />
      <h2 className="orders-empty__title">No orders yet</h2>
      <p className="orders-empty__text">Start your first order from one of our campus cafeterias.</p>
      <button type="button" className="orders-empty__btn" onClick={() => navigate('/cafeterias')}>
        Browse Cafeterias
      </button>
    </div>
  );
}
