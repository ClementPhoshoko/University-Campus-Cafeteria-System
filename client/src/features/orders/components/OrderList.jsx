import OrderCard from './OrderCard.jsx';

export default function OrderList({ orders }) {
  if (orders.length === 0) return null;

  return (
    <div className="orders-list">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
