const BLUE_300 = '#9CCFFF';
const BLUE_500 = '#0A8CFF';
const NEUTRAL_50 = '#F8FAFC';
const NEUTRAL_0 = '#FFFFFF';
const TEXT_PRIMARY = '#1f2937';
const TEXT_SECONDARY = '#6b7280';
const TEXT_MUTED = '#9ca3af';

const WAVE_SVG = `<svg width="480" height="60" viewBox="0 0 480 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 60L40 52C80 44 160 28 240 28C320 28 400 44 440 52L480 60V0H440C400 0 320 0 240 0C160 0 80 0 40 0H0V60Z" fill="${BLUE_300}" fill-opacity="0.15"/>
</svg>`;

const FOOD_ICONS = `<svg width="480" height="80" viewBox="0 0 480 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="20" r="8" fill="${BLUE_300}" fill-opacity="0.2"/>
  <circle cx="120" cy="60" r="6" fill="${BLUE_300}" fill-opacity="0.15"/>
  <circle cx="200" cy="15" r="10" fill="${BLUE_300}" fill-opacity="0.12"/>
  <circle cx="320" cy="55" r="7" fill="${BLUE_300}" fill-opacity="0.18"/>
  <circle cx="400" cy="25" r="9" fill="${BLUE_300}" fill-opacity="0.14"/>
  <circle cx="460" cy="65" r="5" fill="${BLUE_300}" fill-opacity="0.2"/>
</svg>`;

export default function baseLayout({ title, subtitle, content }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${NEUTRAL_50};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NEUTRAL_50};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="${BLUE_500}"/>
                <text x="24" y="32" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="white">M</text>
              </svg>
            </td>
          </tr>

          <!-- Brand Name -->
          <tr>
            <td align="center" style="padding-bottom:4px;">
              <span style="font-size:18px;font-weight:600;color:${TEXT_PRIMARY};letter-spacing:-0.5px;">merchant</span>
              <span style="font-size:18px;font-weight:600;color:${BLUE_500};letter-spacing:-0.5px;">munchies</span>
            </td>
          </tr>

          <!-- Tagline -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:11px;color:${TEXT_SECONDARY};letter-spacing:1px;">GOOD FOOD</span>
              <span style="font-size:11px;color:${BLUE_300};margin:0 6px;">•</span>
              <span style="font-size:11px;color:${BLUE_500};letter-spacing:1px;">LESS QUEUE</span>
              <span style="font-size:11px;color:${BLUE_300};margin:0 6px;">•</span>
              <span style="font-size:11px;color:${TEXT_SECONDARY};letter-spacing:1px;">MORE YOU</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${NEUTRAL_0};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(10,140,255,0.06);">

              <!-- Blue Header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${BLUE_500} 0%,${BLUE_300} 100%);padding:32px 24px;text-align:center;">
                    <h1 style="margin:0;color:${NEUTRAL_0};font-size:20px;font-weight:600;letter-spacing:-0.3px;">${title}</h1>
                    ${subtitle ? `<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${subtitle}</p>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <tr>
                <td style="padding:32px 24px;color:${TEXT_PRIMARY};font-size:15px;line-height:1.6;">
                  ${content}
                </td>
              </tr>

              <!-- Wave -->
              <tr>
                <td style="padding:0;line-height:0;">
                  ${WAVE_SVG}
                </td>
              </tr>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px;">
              <p style="margin:0 0 8px;font-size:11px;color:${TEXT_MUTED};letter-spacing:1px;">GOOD FOOD • LESS QUEUE • MORE YOU</p>
              <p style="margin:0;font-size:11px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} Merchant Munchies. All rights reserved.</p>
            </td>
          </tr>

          <!-- Food Icons -->
          <tr>
            <td style="padding:0;line-height:0;">
              ${FOOD_ICONS}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
