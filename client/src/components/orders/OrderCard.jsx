import { Link } from 'react-router-dom';
import OrderStatusBadge from './OrderStatusBadge.jsx';
import SmartImage from '../ui/SmartImage.jsx';
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
  const logo = order.vendorLogo || vendor?.image || null;
  const vendorName = order.vendorName || vendor?.name || 'Unknown vendor';

  return (
    <Link to={`/orders/${order.id}`} className="order-card">
      <div className="order-card__image">
        <SmartImage src={logo} alt="" width={72} height={72} />
      </div>
      <div className="order-card__body">
        <div className="order-card__header">
          <h3 className="order-card__vendor">{vendorName}</h3>
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
      <div className="order-card__end">
        <span className="order-card__total">R {order.total.toFixed(2)}</span>
        <OrderStatusBadge status={order.status} />
      </div>
    </Link>
  );
}
