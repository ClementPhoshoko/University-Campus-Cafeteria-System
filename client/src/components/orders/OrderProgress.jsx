import { IconCheck, IconClock, IconChefHat, IconClipboardCheck, IconCircleCheck } from '@tabler/icons-react';
import {
  ORDER_STATUSES,
  formatOrderTime,
} from '../../features/orders/orderMockData.js';

const PROGRESS_STEPS = [
  { key: 'placed', label: 'Placed', icon: IconClipboardCheck, match: [ORDER_STATUSES.PAYMENT_PENDING, ORDER_STATUSES.SUBMITTED] },
  { key: 'confirmed', label: 'Confirmed', icon: IconCircleCheck, match: [ORDER_STATUSES.PAYMENT_CONFIRMED, ORDER_STATUSES.RECEIVED_BY_VENDOR, ORDER_STATUSES.ACCEPTED] },
  { key: 'preparing', label: 'Preparing', icon: IconChefHat, match: [ORDER_STATUSES.PREPARING] },
  { key: 'ready', label: 'Ready', icon: IconClock, match: [ORDER_STATUSES.READY_FOR_COLLECTION, ORDER_STATUSES.COLLECTED, ORDER_STATUSES.COMPLETED] },
];

export default function OrderProgress({ order }) {
  const current = order.status;

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
    <div className="order-timeline">
      {PROGRESS_STEPS.map((step, index) => {
        const stepMaxIndex = Math.max(...step.match.map((s) => statusOrder.indexOf(s)));
        let state = 'upcoming';
        if (currentIndex >= stepMaxIndex) state = 'completed';
        if (step.match.includes(current)) state = 'current';
        if (isTerminal) state = 'completed';

        const StepIcon = step.icon;
        const isLast = index === PROGRESS_STEPS.length - 1;

        return (
          <div key={step.key} className={`order-timeline__step order-timeline__step--${state}`}>
            <div className="order-timeline__marker-wrap">
              <div className="order-timeline__marker">
                {state === 'completed' ? (
                  <IconCheck size={16} stroke={2.5} />
                ) : (
                  <StepIcon size={16} stroke={1.8} />
                )}
              </div>
              {state === 'current' && <div className="order-timeline__pulse" />}
            </div>
            {!isLast && (
              <div className="order-timeline__connector">
                <div className="order-timeline__connector-fill" />
              </div>
            )}
            <div className="order-timeline__label">
              <span className="order-timeline__step-name">{step.label}</span>
              {state === 'current' && order.ready_at && (
                <span className="order-timeline__time">{formatOrderTime(order.ready_at)}</span>
              )}
              {state === 'completed' && step.key === 'placed' && order.submitted_at && (
                <span className="order-timeline__time">{formatOrderTime(order.submitted_at)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
