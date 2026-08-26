import baseLayout from './baseLayout.js';

export default function magicLink({ userName, magicUrl }) {
  return baseLayout({
    title: 'Sign in to your account',
    subtitle: 'No password needed',
    content: `
      <p style="margin:0 0 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="margin:0 0 24px;">Click the button below to sign in to your Merchant Munchies account. No password required.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="border-radius:8px;background:#0A8CFF;">
            <a href="${magicUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Sign In</a>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
