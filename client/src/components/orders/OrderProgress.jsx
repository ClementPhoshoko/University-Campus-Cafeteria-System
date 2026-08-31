import { IconCheck } from '@tabler/icons-react';
import {
  ORDER_STATUSES,
  formatOrderTime,
} from '../../features/orders/orderMockData.js';

const PROGRESS_STEPS = [
  { key: 'placed', label: 'Order placed', match: [ORDER_STATUSES.PAYMENT_PENDING, ORDER_STATUSES.SUBMITTED] },
  { key: 'confirmed', label: 'Confirmed', match: [ORDER_STATUSES.PAYMENT_CONFIRMED, ORDER_STATUSES.RECEIVED_BY_VENDOR, ORDER_STATUSES.ACCEPTED] },
  { key: 'preparing', label: 'Preparing', match: [ORDER_STATUSES.PREPARING] },
  { key: 'ready', label: 'Ready for pickup', match: [ORDER_STATUSES.READY_FOR_COLLECTION, ORDER_STATUSES.COLLECTED, ORDER_STATUSES.COMPLETED] },
];

export default function OrderProgress({ order }) {
  const current = order.status;

  // Map each step to completed/current/upcoming based on schema status order.
  const statusOrder = [
    ORDER_STATUSES.PAYMENT_PENDING,
    ORDER_STATUSES.SUBMITTED,
    ORDER_STATUSES.PAYMENT_CONFIRMED,
    ORDER_STATUSES.RECEIVED_BY_VENDOR,
    ORDER_STATUSES.ACCEPTED,
    ORDER_STATUSES.PREPARING,
    ORDER_STATUSES.READY_FOR_COLLECTION,
    ORDER_STATUSES.COLLECTED,
    ORDER_STATUSES.COMPLETED,
  ];

  const currentIndex = statusOrder.indexOf(current);
  const isTerminal = [ORDER_STATUSES.CANCELLED, ORDER_STATUSES.REJECTED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.COLLECTION_NOT_COMPLETED].includes(current);

  return (
    <div className="order-progress">
      {PROGRESS_STEPS.map((step, index) => {
        const stepMaxIndex = Math.max(...step.match.map((s) => statusOrder.indexOf(s)));
        let state = 'upcoming';
        if (currentIndex >= stepMaxIndex) state = 'completed';
        if (step.match.includes(current)) state = 'current';
        if (isTerminal) state = 'completed';

        return (
          <div key={step.key} className={`order-progress__step order-progress__step--${state}`}>
            <div className="order-progress__marker">
              {state === 'completed' ? <IconCheck size={14} stroke={2.5} /> : index + 1}
            </div>
            <div className="order-progress__connector" />
            <div className="order-progress__content">
              <h4 className="order-progress__title">{step.label}</h4>
              {state === 'current' && order.ready_at && (
                <p className="order-progress__time">Estimated ready: {formatOrderTime(order.ready_at)}</p>
              )}
              {state === 'completed' && step.key === 'placed' && order.submitted_at && (
                <p className="order-progress__time">{formatOrderTime(order.submitted_at)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
