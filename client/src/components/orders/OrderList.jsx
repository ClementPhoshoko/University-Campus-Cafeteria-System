import OrderCard from './OrderCard.jsx';

export default function OrderList({ orders }) {
  if (orders.length === 0) return null;

  const groups = new Map();
  orders.forEach((order) => {
    const key = order.vendor_id || order.vendorName || 'unknown-vendor';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: order.vendorName || order.vendor?.name || 'Unknown vendor',
        orders: [],
      });
    }
    groups.get(key).orders.push(order);
  });

  return (
    <div className="orders-list">
      {[...groups.values()].map((group) => (
        <section className="orders-vendor-group" key={group.key} aria-label={`${group.name} orders`}>
          <div className="orders-vendor-group__header">
            <h2 className="orders-vendor-group__title">{group.name}</h2>
            <span className="orders-vendor-group__count">
              {group.orders.length} separate order{group.orders.length !== 1 ? 's' : ''}
            </span>
          </div>
          {group.orders.map((order) => (
            <OrderCard key={order.id} order={order} showVendor={false} />
          ))}
        </section>
      ))}
    </div>
  );
}
