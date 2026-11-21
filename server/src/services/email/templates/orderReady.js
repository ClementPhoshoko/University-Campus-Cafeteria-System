import baseLayout, { ctaButton, infoRow, finePrint } from './baseLayout.js';

export default function orderReady({ userName, orderNumber, vendorName, collectionPoint, actionUrl }) {
  return baseLayout({
    title: 'Your order is ready!',
    subtitle: 'Time to collect your meal',
    content: `
      <p class="e-body" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p class="e-body" style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#374151;">
        Great news — your order is ready for collection now.
      </p>

      <div class="e-order-no" style="font-size:30px;font-weight:700;letter-spacing:3px;color:#0A8CFF;line-height:1;">#${orderNumber}</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
        ${infoRow({ label: 'Collect at', value: collectionPoint })}
        ${infoRow({ label: 'From', value: vendorName })}
      </table>

      ${ctaButton({ href: actionUrl || '#', label: 'View order' })}
      ${finePrint({ children: 'Present your order number at the express collection point.' })}
    `,
  });
}
