import { useState } from 'react';
import { ORDER_STATUSES } from '../../features/orders/orderMockData.js';

export default function OrderActions({ order, onCancel, onReorder, onRate }) {
  const [isCancelling, setIsCancelling] = useState(false);

  const canCancel = [
    ORDER_STATUSES.PAYMENT_PENDING,
    ORDER_STATUSES.SUBMITTED,
    ORDER_STATUSES.PAYMENT_CONFIRMED,
    ORDER_STATUSES.RECEIVED_BY_VENDOR,
    ORDER_STATUSES.ACCEPTED,
    ORDER_STATUSES.PREPARING,
  ].includes(order.status);

  const canRate = order.status === ORDER_STATUSES.COMPLETED;
  const isCollected = order.status === ORDER_STATUSES.COLLECTED || order.status === ORDER_STATUSES.COMPLETED;

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setIsCancelling(true);
    await onCancel?.(order.id, 'User requested cancellation');
    setIsCancelling(false);
  };

  return (
    <div className="order-actions">
      {canCancel && (
        <button
          type="button"
          className="order-actions__btn order-actions__btn--danger"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Order'}
        </button>
      )}
      {!canCancel && !isCollected && (
        <button
          type="button"
          className="order-actions__btn order-actions__btn--secondary"
          onClick={() => onReorder?.(order.id)}
        >
          Reorder
        </button>
      )}
      {canRate && (
        <button
          type="button"
          className="order-actions__btn order-actions__btn--primary"
          onClick={() => onRate?.(order.id)}
        >
          Rate Order
        </button>
      )}
    </div>
  );
}
