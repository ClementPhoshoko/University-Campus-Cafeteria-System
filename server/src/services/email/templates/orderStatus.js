import baseLayout, { ctaButton, infoRow, finePrint } from './baseLayout.js';

const STATUS_COPY = {
  accepted: {
    title: 'Order accepted',
    subtitle: 'The vendor has your order',
    lead: 'Good news — <strong>{vendorName}</strong> has accepted your order <strong>#{orderNumber}</strong>.',
    note: "We'll let you know as soon as your order is being prepared.",
  },
  preparing: {
    title: 'Order being prepared',
    subtitle: 'Your meal is in the works',
    lead: '<strong>{vendorName}</strong> is preparing your order <strong>#{orderNumber}</strong> now.',
    note: "We'll send you another update when it is ready for collection.",
  },
};

/**
 * Shared look for routine order progress. Deliberately mirrors the confirmed
 * and ready templates: quiet typography, small info rows and one real CTA.
 */
export default function orderStatus({ status, userName, orderNumber, vendorName, collectionPoint, actionUrl }) {
  const copy = STATUS_COPY[status] || STATUS_COPY.accepted;
  const lead = copy.lead
    .replace('{vendorName}', vendorName || 'The vendor')
    .replace('{orderNumber}', orderNumber || '');

  return baseLayout({
    title: copy.title,
    subtitle: copy.subtitle,
    content: `
      <p class="e-body" style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p class="e-body" style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#374151;">
        ${lead}${orderNumber ? '' : ' Your order is on track.'}
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
        ${orderNumber ? infoRow({ label: 'Order', value: `<span style="color:#0A8CFF;">#${orderNumber}</span>` }) : ''}
        ${infoRow({ label: 'From', value: vendorName || 'Your vendor' })}
        ${collectionPoint ? infoRow({ label: 'Pickup', value: collectionPoint }) : ''}
      </table>

      ${ctaButton({ href: actionUrl || '#', label: 'View order' })}
      ${finePrint({ children: copy.note })}
    `,
  });
}
