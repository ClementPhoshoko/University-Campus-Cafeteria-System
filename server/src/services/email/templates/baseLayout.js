// Email-safe shared layout — minimal/borderless design system.
// Rules for edits:
// - No <svg> (stripped by Gmail/Outlook). Use hosted PNGs only.
// - No CSS gradients, no background-color panels. White canvas + whitespace.
// - Tables + inline styles only. Absolute image URLs only.
const INK = '#111827';        // headings / strong text
const BODY = '#374151';       // body copy
const MUTED = '#9CA3AF';      // secondary text
const HAIRLINE = '#EAEAEA';   // dividers
const BLUE = '#0A8CFF';       // single accent: CTAs + key values

const LOGO_URL =
  process.env.EMAIL_LOGO_URL ||
  'https://npqvaoimvuwijbalsffp.supabase.co/storage/v1/object/public/email-assets/main_logo.png';

export default function baseLayout({ title, subtitle, content }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* Mobile-first baseline lives in inline styles below.
       These progressive enhancements apply where <style> is supported
       (Gmail, Apple Mail, iOS Mail). Outlook desktop safely ignores this. */
    @media screen and (min-width: 480px) {
      .e-title    { font-size: 23px !important; }
      .e-subtitle { font-size: 15px !important; }
      .e-body     { font-size: 16px !important; }
      .e-otp      { font-size: 40px !important; }
      .e-order-no { font-size: 36px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:48px 24px;">

        <table role="presentation" width="440" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;width:100%;">

          <!-- Brand row: words on top -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="34" style="padding-right:10px;">
                    <img src="${LOGO_URL}" alt="" width="34" height="34" style="display:block;border-radius:8px;">
                  </td>
                  <td style="font-size:15px;font-weight:700;color:${INK};letter-spacing:-0.3px;line-height:34px;">
                    merchant<span style="color:${BLUE};">munchies</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title block -->
          <tr>
            <td style="padding-top:40px;">
              <h1 class="e-title" style="margin:0;font-size:20px;font-weight:600;color:${INK};letter-spacing:-0.2px;">${title}</h1>
              ${subtitle ? `<p class="e-subtitle" style="margin:6px 0 0;font-size:14px;color:${MUTED};">${subtitle}</p>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-top:24px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:48px;">
              <div style="border-top:1px solid ${HAIRLINE};padding-top:16px;font-size:11px;color:${MUTED};line-height:1.7;">
                Good food &bull; Less queue &bull; More you<br>
                &copy; ${new Date().getFullYear()} Merchant Munchies. All rights reserved.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Shared email-safe components
// Outline button: small, light-blue border, no fill.
// Optional unicode icon (SVG is stripped by clients). Auto-appends a plain-link
// fallback line for real URLs so the action still works if the button is blocked.
export function ctaButton({ href, label, icon = null }) {
  const iconHtml = icon ? `<span style="color:${BLUE};margin-right:7px;">${icon}</span>` : '';
  const showFallback = href && href !== '#';
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
  <tr>
    <td bgcolor="#FFFFFF" style="border:1px solid #B8DBFF;border-radius:6px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:8px 20px;font-size:13px;font-weight:600;color:${BLUE};text-decoration:none;letter-spacing:0.2px;">${iconHtml}${label}</a>
    </td>
  </tr>
</table>${
    showFallback
      ? `
<p style="margin:14px 0 0;font-size:11px;color:${MUTED};line-height:1.6;">
  If the button above isn't working, paste this link into your browser:<br>
  <a href="${href}" target="_blank" style="color:${BLUE};text-decoration:none;word-break:break-all;">${href}</a>
</p>`
      : ''
  }`;
}

export function infoRow({ label, value }) {
  return `
<tr>
  <td style="padding:5px 0;font-size:14px;color:${MUTED};white-space:nowrap;">${label}</td>
  <td style="padding:5px 0;font-size:14px;font-weight:600;color:${INK};text-align:right;">${value}</td>
</tr>`;
}

export function finePrint({ children }) {
  return `<p style="margin:20px 0 0;font-size:12px;color:${MUTED};line-height:1.6;">${children}</p>`;
}

export { INK, BODY, MUTED, HAIRLINE, BLUE };
