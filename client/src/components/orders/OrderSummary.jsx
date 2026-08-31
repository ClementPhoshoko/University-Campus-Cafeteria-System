export default function OrderSummary({ order }) {
  return (
    <div className="order-detail__panel">
      <h3 className="order-detail__panel-title">Summary</h3>
      <div className="order-summary__row">
        <span>Subtotal</span>
        <span>R {order.subtotal.toFixed(2)}</span>
      </div>
      <div className="order-summary__row">
        <span>Service fee</span>
        <span>R {order.service_fee.toFixed(2)}</span>
      </div>
      {order.tax > 0 && (
        <div className="order-summary__row">
          <span>Tax</span>
          <span>R {order.tax.toFixed(2)}</span>
        </div>
      )}
      {order.discount > 0 && (
        <div className="order-summary__row">
          <span>Discount</span>
          <span>-R {order.discount.toFixed(2)}</span>
        </div>
      )}
      <div className="order-summary__row order-summary__row--total">
        <span>Total</span>
        <span>R {order.total.toFixed(2)}</span>
      </div>
    </div>
  );
}
