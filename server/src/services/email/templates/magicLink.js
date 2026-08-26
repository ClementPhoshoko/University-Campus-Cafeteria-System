import baseLayout, { ctaButton, finePrint } from './baseLayout.js';

export default function magicLink({ userName, magicUrl }) {
  return baseLayout({
    title: 'Sign in to your account',
    subtitle: 'No password needed',
    content: `
      <p style="margin:0 0 14px;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p style="margin:0;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">
        Tap the button below to sign in to Merchant Munchies — no password required.
      </p>
      ${ctaButton({ href: magicUrl, label: 'Sign In' })}
      ${finePrint({ children: "If you didn't request this link, you can safely ignore this email." })}
    `,
  });
}
