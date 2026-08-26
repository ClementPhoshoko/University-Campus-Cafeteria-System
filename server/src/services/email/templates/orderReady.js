import baseLayout from './baseLayout.js';

export default function orderReady({ userName, orderNumber, vendorName, collectionPoint }) {
  return baseLayout({
    title: 'Your order is ready!',
    subtitle: 'Time to collect your meal',
    content: `
      <p style="margin:0 0 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="margin:0 0 24px;">Great news! Your order is ready for collection.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F1F8FF;border-radius:12px;border:1px solid #9CCFFF;">
        <tr>
          <td style="padding:20px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Order</p>
            <p style="margin:0 0 16px;font-size:24px;font-weight:700;color:#0A8CFF;letter-spacing:2px;">#${orderNumber}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Pick up at</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:#1f2937;">${collectionPoint}</p>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td style="padding:0 0 8px;font-size:13px;color:#6b7280;">From</td>
        </tr>
        <tr>
          <td style="padding:0;font-size:15px;font-weight:600;color:#1f2937;">${vendorName}</td>
        </tr>
      </table>

      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Present your order number at the express collection point.</p>
    `,
  });
}
