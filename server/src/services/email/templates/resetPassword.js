import baseLayout from './baseLayout.js';

export default function resetPassword({ userName, otp, expiresIn }) {
  return baseLayout({
    title: 'Reset your password',
    subtitle: 'Secure your account',
    content: `
      <p style="margin:0 0 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="margin:0 0 24px;">We received a request to reset your password. Use the OTP code below to proceed:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td style="background:#F1F8FF;border:2px dashed #9CCFFF;border-radius:12px;padding:16px 40px;text-align:center;">
            <span style="font-size:32px;font-weight:700;color:#0A8CFF;letter-spacing:6px;">${otp}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-align:center;">This code expires within <strong>${expiresIn}</strong></p>
      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">If you didn't request this, please ignore this email.</p>
    `,
  });
}
