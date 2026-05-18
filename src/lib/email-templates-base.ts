/**
 * Base responsive email template utilities — Sunday Huddle dark theme
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
      <td style="padding:32px 16px;">

        <!-- Main card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;max-width:600px;width:100%;background-color:${C.bg};border-radius:10px;border:1px solid ${C.border};border-top:3px solid ${accentColor};">

          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;text-align:center;">
              <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;color:${C.greenHi};text-transform:uppercase;font-weight:700;">Sunday Huddle</p>
              <h1 style="margin:0;font-size:24px;font-weight:900;color:${C.text};letter-spacing:0.04em;text-transform:uppercase;line-height:1.1;">${title}</h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:${C.border};"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:28px 32px;">
              ${content}

              ${buttonText && buttonUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 8px;">
                <tr>
                  <td style="text-align:center;">
                    <a href="${buttonUrl}" style="display:inline-block;background-color:${accentColor};color:${C.text};text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid ${C.border};text-align:center;">
              <p style="margin:0 0 6px;color:${C.textDim};font-size:12px;line-height:1.5;">${footerText}</p>
              <p style="margin:0;color:${C.textDim};font-size:11px;">© ${new Date().getFullYear()} Sunday Huddle. All rights reserved.</p>
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
