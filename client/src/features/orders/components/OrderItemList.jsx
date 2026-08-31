function OrderItemRow({ item }) {
  const customizations = item.customization_snapshot || [];

  return (
    <div className="order-item">
      <span className="order-item__qty">{item.quantity}</span>
      <div className="order-item__body">
        <h4 className="order-item__name">{item.item_name_snapshot}</h4>
        {customizations.length > 0 && (
          <p className="order-item__customizations">
            {customizations.map((c) => c.name).join(', ')}
          </p>
        )}
        {item.special_instructions && (
          <p className="order-item__instructions">“{item.special_instructions}”</p>
        )}
      </div>
      <span className="order-item__price">R {item.line_total.toFixed(2)}</span>
    </div>
  );
}

export default function OrderItemList({ items }) {
  return (
    <div className="order-detail__panel">
      <h3 className="order-detail__panel-title">Order Items</h3>
      {items.map((item) => (
        <OrderItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}
