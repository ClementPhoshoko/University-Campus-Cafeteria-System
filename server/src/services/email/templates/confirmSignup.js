import baseLayout from './baseLayout.js';

export default function confirmSignup({ userName, confirmUrl }) {
  return baseLayout({
    title: 'Confirm your email',
    subtitle: 'One step closer to skipping the queue',
    content: `
      <p style="margin:0 0 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="margin:0 0 24px;">Welcome to Merchant Munchies! Click the button below to confirm your email and start browsing cafeterias near you.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="border-radius:8px;background:#0A8CFF;">
            <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Confirm Email</a>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">If you didn't create an account, you can safely ignore this email.</p>
    `,
  });
}
