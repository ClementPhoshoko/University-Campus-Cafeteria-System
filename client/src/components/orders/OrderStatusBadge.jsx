const ORDER_STATUSES = {
  PAYMENT_PENDING: 'payment_pending',
  SUBMITTED: 'submitted',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  RECEIVED_BY_VENDOR: 'received_by_vendor',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_COLLECTION: 'ready_for_collection',
  COLLECTED: 'collected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
  COLLECTION_NOT_COMPLETED: 'collection_not_completed',
};

const LABELS = {
  [ORDER_STATUSES.PAYMENT_PENDING]: 'Payment Pending',
  [ORDER_STATUSES.SUBMITTED]: 'Submitted',
  [ORDER_STATUSES.PAYMENT_CONFIRMED]: 'Payment Confirmed',
  [ORDER_STATUSES.RECEIVED_BY_VENDOR]: 'Received',
  [ORDER_STATUSES.ACCEPTED]: 'Accepted',
  [ORDER_STATUSES.PREPARING]: 'Preparing',
  [ORDER_STATUSES.READY_FOR_COLLECTION]: 'Ready',
  [ORDER_STATUSES.COLLECTED]: 'Collected',
  [ORDER_STATUSES.COMPLETED]: 'Completed',
  [ORDER_STATUSES.CANCELLED]: 'Cancelled',
  [ORDER_STATUSES.REJECTED]: 'Rejected',
  [ORDER_STATUSES.REFUNDED]: 'Refunded',
  [ORDER_STATUSES.COLLECTION_NOT_COMPLETED]: 'Not Collected',
};

export default function OrderStatusBadge({ status }) {
  const label = LABELS[status] || status.replace(/_/g, ' ');
  const className = `order-status-badge order-status-badge--${status}`;

  return (
    <span className={className}>
      {label}
    </span>
  );
}
