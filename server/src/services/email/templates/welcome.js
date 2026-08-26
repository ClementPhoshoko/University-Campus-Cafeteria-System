import baseLayout from './baseLayout.js';

export default function welcome({ userName, appUrl }) {
  const startUrl = appUrl || '#';
  return baseLayout({
    title: 'Welcome aboard!',
    subtitle: 'Your account is ready',
    content: `
      <p style="margin:0 0 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="margin:0 0 24px;">You have just created a new account on <strong style="color:#0A8CFF;">Merchant</strong>&nbsp;<strong>Munchies</strong> — good food, less queue, more you.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="padding:12px 16px;background:#F8FAFC;border-radius:8px;border-left:3px solid #0A8CFF;">
            <p style="margin:0;font-size:14px;color:#1f2937;">Browse menus from campus cafeterias</p>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#F8FAFC;border-radius:8px;border-left:3px solid #9CCFFF;">
            <p style="margin:0;font-size:14px;color:#1f2937;">Order ahead and choose your pickup time</p>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#F8FAFC;border-radius:8px;border-left:3px solid #0A8CFF;">
            <p style="margin:0;font-size:14px;color:#1f2937;">Track your order in real time</p>
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="border-radius:8px;background:#0A8CFF;">
            <a href="${startUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Start Ordering</a>
          </td>
        </tr>
      </table>
    `,
  });
}
