import baseLayout, { ctaButton, finePrint } from './baseLayout.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function cartExpiringSoon({ userName, vendorName, cartUrl }) {
  const safeUrl = escapeHtml(cartUrl);
  return baseLayout({
    title: 'Your cart expires in 20 minutes',
    subtitle: 'Complete your order before your cart expires',
    content: `
      <p class="e-body" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">
        Hi <strong style="color:#111827;">${escapeHtml(userName)}</strong>,
      </p>
      <p class="e-body" style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;">
        Your cart${vendorName ? ` from <strong>${escapeHtml(vendorName)}</strong>` : ''} expires in about 20 minutes.
        Return to the cafeteria to review your items and complete your order.
      </p>
      ${ctaButton({ href: safeUrl, label: 'Return to your cart' })}
      ${finePrint({ children: 'This is a one-time reminder. Items and prices may change before checkout.' })}
    `,
  });
}
