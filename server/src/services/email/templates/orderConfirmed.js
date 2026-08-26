import baseLayout from './baseLayout.js';

export default function orderConfirmed({ userName, orderNumber, vendorName, collectionTime, items, total }) {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #F1F8FF;font-size:14px;color:#1f2937;">${item.name} × ${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #F1F8FF;font-size:14px;color:#1f2937;text-align:right;">R${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  return baseLayout({
    title: 'Order confirmed!',
    subtitle: 'Your meal is being prepared',
    content: `
      <p style="margin:0 0 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="margin:0 0 24px;">Your order has been placed successfully. Here are your order details:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8FAFC;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;">
            <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Order</span><br>
            <span style="font-size:15px;font-weight:600;color:#0A8CFF;">#${orderNumber}</span>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;text-align:right;">
            <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Pickup</span><br>
            <span style="font-size:15px;font-weight:600;color:#1f2937;">${collectionTime}</span>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td style="padding:0 0 8px;font-size:13px;color:#6b7280;">From</td>
        </tr>
        <tr>
          <td style="padding:0 0 16px;font-size:15px;font-weight:600;color:#1f2937;">${vendorName}</td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:0 0 8px;font-size:13px;color:#6b7280;">Items</td>
        </tr>
        ${itemsHtml}
        <tr>
          <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1f2937;">Total</td>
          <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1f2937;text-align:right;">R${total.toFixed(2)}</td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
        <tr>
          <td style="border-radius:8px;background:#0A8CFF;">
            <a href="#" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Track Order</a>
          </td>
        </tr>
      </table>
    `,
  });
}
