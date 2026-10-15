import { useNavigate } from 'react-router-dom';
import PrimaryButton from '../PrimaryButton.jsx';
import CollectionCode from './CollectionCode.jsx';
import successImg from '../../assets/avatars/Cheerful_Student_with_Green_Checkmark.webp';

export default function OrderConfirmation({ orderId, collectionCode, onContinue }) {
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
      <img src={successImg} alt="" className="order-confirmation__avatar" loading="eager" />
      <h1 className="order-confirmation__title">Order Placed!</h1>
      <p className="order-confirmation__text">
        Your order has been received and is being prepared.
      </p>
      <p className="order-confirmation__hint">
        Keep this code ready to show when your order is ready.
      </p>
      <CollectionCode order={{ collectionCode }} />
      <div className="order-confirmation__actions">
        <PrimaryButton onClick={handleTrack}>
          Track Order
        </PrimaryButton>
        <PrimaryButton onClick={handleHome}>
          Back to Home
        </PrimaryButton>
      </div>
    </div>
  );
}
