import baseLayout, { ctaButton, finePrint } from './baseLayout.js';

export default function confirmSignup({ userName, confirmUrl }) {
  return baseLayout({
    title: 'Confirm your email',
    subtitle: 'One step closer to skipping the queue',
    content: `
      <p style="margin:0 0 14px;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p style="margin:0;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">
        Welcome to Merchant Munchies! Confirm your email address to activate your account
        and start browsing cafeterias near you.
      </p>
      ${ctaButton({ href: confirmUrl, label: 'Confirm Email', icon: '\u2713' })}
      ${finePrint({ children: "If you didn't create an account, you can safely ignore this email." })}
    `,
  });
}
