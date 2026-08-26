import baseLayout, { finePrint } from './baseLayout.js';

export default function resetPassword({ userName, otp, expiresIn }) {
  return baseLayout({
    title: 'Reset your password',
    subtitle: 'Enter this code to continue',
    content: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#374151;">
        We received a request to reset your password. Enter the code below in the app:
      </p>

      <div class="e-otp" style="font-size:34px;font-weight:700;letter-spacing:12px;color:#0A8CFF;line-height:1;">${otp}</div>

      ${finePrint({ children: `This code expires within <strong>${expiresIn}</strong>. If you didn't request a reset, you can safely ignore this email.` })}
    `,
  });
}
