import { useNavigate } from 'react-router-dom';
import successImg from '../../../assets/avatars/Cheerful_Student_with_Green_Checkmark.png';

export default function OrderConfirmation({ orderId, onContinue }) {
  const navigate = useNavigate();

  const handleTrack = () => {
    onContinue?.();
    navigate(`/orders/${orderId}`);
  };

  const handleHome = () => {
    onContinue?.();
    navigate('/');
  };

  return (
    <div className="order-confirmation">
      <img src={successImg} alt="" className="order-confirmation__avatar" />
      <h1 className="order-confirmation__title">Order Placed!</h1>
      <p className="order-confirmation__text">
        Your order has been received and is being prepared.
      </p>
      <p className="order-confirmation__hint">
        Use your collection code when the order is ready.
      </p>
      <div className="order-confirmation__actions">
        <button type="button" className="order-confirmation__btn order-confirmation__btn--primary" onClick={handleTrack}>
          Track Order
        </button>
        <button type="button" className="order-confirmation__btn order-confirmation__btn--secondary" onClick={handleHome}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
