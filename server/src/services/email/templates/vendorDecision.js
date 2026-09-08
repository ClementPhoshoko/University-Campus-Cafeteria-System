import baseLayout from './baseLayout.js';

export default function vendorDecision({ vendorName, decision, reason, appUrl }) {
  const approved = decision === 'approved';
  const title = approved ? 'Your vendor application was approved' : `Your vendor application was ${decision}`;
  const message = approved
    ? 'Your vendor profile is now active. You can continue preparing your locations, staff and menus for service.'
    : `Your vendor application was ${decision}.${reason ? ` Reason: ${reason}` : ''}`;
  return baseLayout({
    title,
    subtitle: 'Merchant Munchies vendor operations',
    content: `<h1>${title}</h1><p>Hello ${vendorName || 'there'},</p><p>${message}</p><p><a href="${appUrl}">Open Merchant Munchies</a></p>`,
  });
}
