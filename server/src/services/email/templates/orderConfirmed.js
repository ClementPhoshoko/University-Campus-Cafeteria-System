import baseLayout, { ctaButton, infoRow, finePrint } from './baseLayout.js';

export default function orderConfirmed({ userName, orderNumber, vendorName, collectionTime, items, total }) {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #F0F0F0;font-size:14px;color:#374151;">${item.name} &times; ${item.quantity}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0F0F0;font-size:14px;color:#111827;text-align:right;">R${item.price.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  return baseLayout({
    title: 'Order confirmed!',
    subtitle: 'Your meal is being prepared',
    content: `
      <p style="margin:0 0 14px;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p style="margin:0 0 22px;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">
        Your order has been placed successfully.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
        ${infoRow({ label: 'Order', value: `<span style="color:#0A8CFF;">#${orderNumber}</span>` })}
        ${infoRow({ label: 'Pickup', value: collectionTime })}
        ${infoRow({ label: 'From', value: vendorName })}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${itemRows}
        <tr>
          <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:#111827;border-top:2px solid #111827;margin-top:2px;">Total</td>
          <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#111827;text-align:right;border-top:2px solid #111827;">R${total.toFixed(2)}</td>
        </tr>
      </table>

      ${ctaButton({ href: '#', label: 'Track Order' })}
      ${finePrint({ children: 'You will receive another email when your order is ready for collection.' })}
    `,
  });
}
