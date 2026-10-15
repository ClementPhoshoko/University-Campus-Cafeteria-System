import { Link } from 'react-router-dom';
import OrderStatusBadge from './OrderStatusBadge.jsx';
import SmartImage from '../ui/SmartImage.jsx';

function formatOrderDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatOrderTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function OrderCard({ order, showVendor = true, onImageError }) {
  const itemNames = Array.isArray(order.items)
    ? order.items.map((item) => `${item.quantity || 1}× ${item.item_name_snapshot || item.name || 'Item'}`)
    : [];
  const displayItems = itemNames.slice(0, 2).join(', ');
  const remaining = Math.max(itemNames.length - 2, 0);
  const logo = order.vendorLogo || order.vendor?.logo_url || null;
  const vendorName = order.vendorName || order.vendor?.name || 'Unknown vendor';
  const total = Number(order.total || 0);

  return (
    <Link to={`/orders/${order.id}`} className="order-card">
      <div className="order-card__image">
        <SmartImage
          src={logo}
          alt=""
          width={72}
          height={72}
          onError={() => onImageError?.(order.vendor_id, logo)}
        />
      </div>
      <div className="order-card__body">
        <div className="order-card__header">
          {showVendor && <h3 className="order-card__vendor">{vendorName}</h3>}
        </div>
        <div className="order-card__meta">
          {order.collectionCode ? (
            <span>Collection code <strong className="order-card__collection-code">{order.collectionCode}</strong></span>
          ) : order.order_reference ? (
            <span>Order ref <strong>{order.order_reference}</strong></span>
          ) : null}
          <span>{formatOrderDate(order.created_at)}</span>
          <span>{formatOrderTime(order.created_at)}</span>
        </div>
        <p className="order-card__items">
          {displayItems}
          {remaining > 0 && ` +${remaining} more`}
        </p>
      </div>
      <div className="order-card__end">
        <span className="order-card__total">R {total.toFixed(2)}</span>
        <OrderStatusBadge status={order.status} />
      </div>
    </Link>
  );
}
