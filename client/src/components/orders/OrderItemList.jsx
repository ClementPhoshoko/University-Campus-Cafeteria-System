function OrderItemRow({ item }) {
  const customizations = item.customization_snapshot || [];
  const dietarySnapshot = Array.isArray(item.dietary_snapshot) ? item.dietary_snapshot : [];
  const dietaryTags = dietarySnapshot.filter((entry) => typeof entry === 'string' || entry?.type === 'dietary_tag').map((entry) => typeof entry === 'string' ? entry : entry.name).filter(Boolean);
  const allergens = dietarySnapshot.filter((entry) => entry?.type === 'allergen' && entry.name);

  return (
    <div className="order-item">
      <span className="order-item__qty">{item.quantity}</span>
      <div className="order-item__body">
        <h4 className="order-item__name">{item.item_name_snapshot}</h4>
        {customizations.length > 0 && (
          <p className="order-item__customizations">
            {customizations.map((c) => `${c.name}${c.quantity > 1 ? ` × ${c.quantity}` : ''}`).join(', ')}
          </p>
        )}
        {dietaryTags.length > 0 && <p className="order-item__dietary">Dietary: {dietaryTags.join(', ')}</p>}
        {allergens.length > 0 && <p className="order-item__dietary">Contains: {allergens.map((allergen) => `${allergen.name}${allergen.vendor_notice ? ` (${allergen.vendor_notice})` : ''}`).join(', ')}</p>}
        {item.special_instructions && (
          <p className="order-item__instructions">“{item.special_instructions}”</p>
        )}
      </div>
      <span className="order-item__price">R {Number(item.line_total || 0).toFixed(2)}</span>
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
