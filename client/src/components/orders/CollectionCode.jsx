export default function CollectionCode({ order }) {
  return (
    <div className="collection-code">
      <span className="collection-code__label">Collection Code</span>
      <span className="collection-code__value">{order.collection_reference_last4 || '----'}</span>
      <span className="collection-code__hint">Show this code when collecting your order</span>
    </div>
  );
}
