import baseLayout, { ctaButton } from './baseLayout.js';

const FEATURES = [
  'Browse menus from our cafeterias',
  'Order ahead and choose your pickup time',
  'Track your order in real time',
];

export default function welcome({ userName, appUrl }) {
  const startUrl = appUrl || '#';
  const list = FEATURES.map(
    (text) => `
      <tr>
        <td width="20" style="padding:5px 0;font-size:14px;color:#0A8CFF;line-height:1.6;" valign="top">&bull;</td>
        <td style="padding:5px 0;font-size:15px;line-height:1.6;color:#374151;">${text}</td>
      </tr>`
  ).join('');

  return baseLayout({
    title: 'Welcome aboard!',
    subtitle: 'Your account is ready',
    content: `
      <p style="margin:0 0 14px;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">Hi <strong style="color:#111827;">${userName}</strong>,</p>
      <p style="margin:0 0 18px;class="e-body" style="font-size:15px;line-height:1.65;color:#374151;">
        You have just created a new account on <strong style="color:#111827;">Merchant Munchies</strong>.
        Here's what you can do:
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${list}</table>

      ${ctaButton({ href: startUrl, label: 'Start Ordering' })}
    `,
  });
}
