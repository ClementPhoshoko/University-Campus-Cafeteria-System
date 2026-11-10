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

export default function vendorInvitation({ vendorName, role, inviteUrl, expiresAt }) {
  const safeVendorName = escapeHtml(vendorName);
  const safeRole = escapeHtml(role);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const expires = new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(expiresAt));

  return baseLayout({
    title: `Join ${safeVendorName} on Merchant Munchies`,
    subtitle: 'Vendor team invitation',
    content: `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">You have been invited to join <strong>${safeVendorName}</strong> as vendor ${safeRole}. Sign in or create an account using this email address to accept.</p>${ctaButton({ href: safeInviteUrl, label: 'Review invitation' })}${finePrint({ children: `This single-use invitation expires at the end of ${expires} South African time. Public holidays are not counted as business days.` })}`,
  });
}
