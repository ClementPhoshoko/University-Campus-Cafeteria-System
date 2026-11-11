import baseLayout, { ctaButton, finePrint } from './baseLayout.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export default function vendorJoined({ vendorName, role, loginUrl }) {
  const safeVendorName = escapeHtml(vendorName);
  const safeRole = escapeHtml(role);
  const safeLoginUrl = escapeHtml(loginUrl);

  return baseLayout({
    title: `You joined ${safeVendorName}`,
    subtitle: 'Vendor team membership confirmed',
    content: `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">You have joined <strong>${safeVendorName}</strong> as a vendor ${safeRole}. Your access is limited to this vendor.</p>${ctaButton({ href: safeLoginUrl, label: 'Sign in to Merchant Munchies' })}${finePrint({ children: 'If you did not accept this invitation, contact your vendor administrator.' })}`,
  });
}
