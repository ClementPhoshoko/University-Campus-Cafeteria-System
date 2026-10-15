import { QRCodeSVG } from 'qrcode.react';

export default function CollectionCode({ order }) {
  const code = order.collectionCode || order.collection_reference_last4;
  if (!code) return null;

  return (
    <div className="collection-code">
      <span className="collection-code__label">Collection Code</span>
      <div className="collection-code__qr">
        <QRCodeSVG
          value={code}
          size={120}
          level="M"
          bgColor="transparent"
          fgColor="currentColor"
        />
      </div>
      <span className="collection-code__value">{code}</span>
      <span className="collection-code__hint">Show this code when collecting your order</span>
    </div>
  );
}
