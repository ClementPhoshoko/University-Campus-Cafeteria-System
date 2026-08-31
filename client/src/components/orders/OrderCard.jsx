import { Link } from 'react-router-dom';
import OrderStatusBadge from './OrderStatusBadge.jsx';
import {
  getVendorById,
  getItemsForOrder,
  formatOrderDate,
  formatOrderTime,
} from '../../features/orders/orderMockData.js';

export default function OrderCard({ order }) {
  const vendor = getVendorById(order.vendor_id);
  const items = getItemsForOrder(order.id);
  const itemNames = items.map((item) => `${item.quantity}× ${item.item_name_snapshot}`);
  const displayItems = itemNames.slice(0, 2).join(', ');
  const remaining = itemNames.length - 2;

  return (
    <Link to={`/orders/${order.id}`} className="order-card">
      <div className="order-card__image">
        <img src={vendor?.image} alt="" loading="lazy" />
      </div>
      <div className="order-card__body">
        <div className="order-card__header">
          <h3 className="order-card__vendor">{vendor?.name || 'Unknown vendor'}</h3>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="order-card__meta">
          <span>#{order.order_number}</span>
          <span>{formatOrderDate(order.created_at)}</span>
          <span>{formatOrderTime(order.created_at)}</span>
        </div>
        <p className="order-card__items">
          {displayItems}
          {remaining > 0 && ` +${remaining} more`}
        </p>
      </div>
      <span className="order-card__total">R {order.total.toFixed(2)}</span>
    </Link>
  );
}
