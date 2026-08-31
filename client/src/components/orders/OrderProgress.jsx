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

  // Calculate progress percentage for the fill line
  let progressPercent = 0;
  if (isTerminal) {
    progressPercent = 100;
  } else {
    const stepIndex = PROGRESS_STEPS.findIndex((step) => step.match.includes(current));
    if (stepIndex >= 0) {
      progressPercent = (stepIndex / (PROGRESS_STEPS.length - 1)) * 100;
    }
  }

  return (
    <div className="order-timeline">
      <div className="order-timeline__track">
        <div className="order-timeline__track-bg" />
        <div className="order-timeline__track-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="order-timeline__steps">
        {PROGRESS_STEPS.map((step) => {
          const stepMaxIndex = Math.max(...step.match.map((s) => statusOrder.indexOf(s)));
          let state = 'upcoming';
          if (currentIndex >= stepMaxIndex) state = 'completed';
          if (step.match.includes(current)) state = 'current';
          if (isTerminal) state = 'completed';

          const StepIcon = step.icon;

          return (
            <div key={step.key} className={`order-timeline__step order-timeline__step--${state}`}>
              <div className="order-timeline__marker">
                {state === 'completed' ? (
                  <IconCheck size={16} stroke={2.5} />
                ) : (
                  <StepIcon size={16} stroke={1.8} />
                )}
                {state === 'current' && <span className="order-timeline__pulse" />}
              </div>
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
    </div>
  );
}
