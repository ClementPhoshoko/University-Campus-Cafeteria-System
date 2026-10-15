import baseLayout, { ctaButton, finePrint } from './baseLayout.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function cartExpired({ userName, vendorName, cartUrl }) {
  const safeUrl = escapeHtml(cartUrl);
  return baseLayout({
    title: 'Your cart has expired',
    subtitle: 'Your saved items are no longer reserved',
    content: `
      <p class="e-body" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">
        Hi <strong style="color:#111827;">${escapeHtml(userName)}</strong>,
      </p>
      <p class="e-body" style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;">
        Your cart${vendorName ? ` from <strong>${escapeHtml(vendorName)}</strong>` : ''} expired after two hours of inactivity.
        The items were not ordered, but you can visit the menu and add them again.
      </p>
      ${ctaButton({ href: safeUrl, label: 'Browse cafeterias' })}
      ${finePrint({ children: 'This is a one-time notice for this expired cart. Prices and availability may have changed.' })}
    `,
  });
}
