/**
 * Base responsive email template utilities — Sunday Huddle dark theme.
 *
 * Layout is a plain, single-column newsletter shell (small wordmark, a
 * left-aligned heading, flowing body copy, one plain button, a quiet
 * footer) — no bordered "card" box, no all-caps banner header. Modeled on
 * a classic simple Mailchimp campaign's structure, not its light color
 * scheme: every existing content string across email.ts already hardcodes
 * text colors for this dark background, so only the shell changed.
 */

// Dark theme palette (email-safe hex)
const C = {
  outerBg:   '#080c12',
  bg:        '#0d1117',
  card:      '#141c26',
  border:    '#1e2a3a',
  green:     '#1e6e43',
  greenHi:   '#4ade80',
  gold:      '#d4a520',
  text:      '#f1f5f9',
  textMid:   '#94a3b8',
  textDim:   '#64748b',
};

export interface ResponsiveEmailOptions {
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
  accentColor?: string;
}

// Structure follows a plain single-column newsletter layout (no bordered
// "card" box, no shouty all-caps header) instead of the previous boxed,
// heavily-branded shell — see the redesign note above the palette. Content
// strings passed in by every caller in email.ts already hardcode text
// colors for this same dark background (${C.text}/${C.textMid} equivalents
// like #f1f5f9/#94a3b8), so the palette itself is unchanged; only the shell
// around it is simpler.
export function createResponsiveEmailTemplate(options: ResponsiveEmailOptions): string {
  const {
    title,
    content,
    buttonText,
    buttonUrl,
    footerText = 'This is an automated notification from Sunday Huddle.',
    accentColor = C.green,
  } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">body,table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.outerBg};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${C.outerBg};">
    <tr>
      <td style="padding:40px 20px;">

        <!-- Single flowing column, no card/border around it -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="margin:0 auto;max-width:560px;width:100%;">

          <!-- Small wordmark, not a big branded banner -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background-color:${accentColor};margin-right:8px;vertical-align:middle;"></span>
              <span style="font-size:12px;font-weight:700;letter-spacing:0.14em;color:${C.textMid};text-transform:uppercase;vertical-align:middle;">Sunday Huddle</span>
            </td>
          </tr>

          <!-- Heading — left-aligned like the body it introduces -->
          <tr>
            <td style="padding-bottom:18px;">
              <h1 style="margin:0;font-size:21px;font-weight:700;color:${C.text};line-height:1.35;">${title}</h1>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="font-size:15px;line-height:1.65;">
              ${content}

              ${buttonText && buttonUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 4px;">
                <tr>
                  <td style="border-radius:6px;background-color:${accentColor};">
                    <a href="${buttonUrl}" style="display:inline-block;color:${C.text};text-decoration:none;padding:12px 28px;font-weight:600;font-size:15px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer — quiet, no box -->
          <tr>
            <td style="padding-top:32px;margin-top:8px;">
              <div style="height:1px;background-color:${C.border};margin-bottom:16px;"></div>
              <p style="margin:0 0 4px;color:${C.textDim};font-size:12px;line-height:1.5;">${footerText}</p>
              <p style="margin:0;color:${C.textDim};font-size:11px;">© ${new Date().getFullYear()} Sunday Huddle</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function createInfoBox(content: string, type: 'info' | 'warning' | 'success' | 'error' = 'info'): string {
  const colors = {
    info:    { bg: '#0d1e35', border: '#3b82f6', text: '#93c5fd' },
    warning: { bg: '#1c1608', border: '#d4a520', text: '#fcd34d' },
    success: { bg: '#091a0f', border: '#1e6e43', text: '#4ade80' },
    error:   { bg: '#1a0a0a', border: '#dc2626', text: '#fca5a5' },
  };
  const c = colors[type];
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:18px 0;">
      <tr>
        <td style="background-color:${c.bg};border-left:3px solid ${c.border};padding:14px 18px;border-radius:0 6px 6px 0;">
          <p style="margin:0;color:${c.text};font-size:14px;line-height:1.65;">${content}</p>
        </td>
      </tr>
    </table>`.trim();
}

export function createTwoColumnGrid(leftContent: string, rightContent: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:18px 0;">
      <tr>
        <td style="padding:0 8px 0 0;width:50%;vertical-align:top;">${leftContent}</td>
        <td style="padding:0 0 0 8px;width:50%;vertical-align:top;">${rightContent}</td>
      </tr>
    </table>`.trim();
}

export function createParticipantTable(participants: Array<{ name: string; email?: string }>): string {
  if (participants.length === 0) return createInfoBox('No participants found.', 'info');

  const rows = participants.map(p => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #1e2a3a;color:#f1f5f9;font-size:14px;">${p.name}</td>
      ${p.email ? `<td style="padding:10px 14px;border-bottom:1px solid #1e2a3a;color:#94a3b8;font-size:13px;">${p.email}</td>` : ''}
    </tr>`).join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;border-collapse:collapse;background-color:#141c26;border-radius:6px;border:1px solid #1e2a3a;">
      <thead>
        <tr style="background-color:#1e2a3a;">
          <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Name</th>
          ${participants[0]?.email ? `<th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Email</th>` : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`.trim();
}
