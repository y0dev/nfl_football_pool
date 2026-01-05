/**
 * Base responsive email template utilities
 * Provides consistent, mobile-friendly email templates
 */

export interface ResponsiveEmailOptions {
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
  backgroundColor?: string;
  accentColor?: string;
}

/**
 * Creates a responsive email wrapper with modern styling
 */
export function createResponsiveEmailTemplate(options: ResponsiveEmailOptions): string {
  const {
    title,
    content,
    buttonText,
    buttonUrl,
    footerText = 'This is an automated notification from the NFL Confidence Pool system.',
    backgroundColor = '#ffffff',
    accentColor = '#3b82f6'
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
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 20px 0;">
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: ${backgroundColor}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; text-align: center; background: linear-gradient(135deg, ${accentColor} 0%, #2563eb 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.2;">
                🏈 ${title}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              ${content}
              
              ${buttonText && buttonUrl ? `
              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${buttonUrl}" 
                       style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; line-height: 1.5; text-align: center; min-width: 200px;">
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
            <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5; text-align: center;">
                ${footerText}
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Spacer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding: 20px 0; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} NFL Confidence Pool. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Creates a responsive info box
 */
export function createInfoBox(content: string, type: 'info' | 'warning' | 'success' | 'error' = 'info'): string {
  const colors = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }
  };

  const color = colors[type];

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background-color: ${color.bg}; border-left: 4px solid ${color.border}; padding: 16px 20px; border-radius: 6px;">
          <p style="margin: 0; color: ${color.text}; font-size: 15px; line-height: 1.6;">
            ${content}
          </p>
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Creates a responsive two-column grid (stacks on mobile)
 */
export function createTwoColumnGrid(leftContent: string, rightContent: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 0 10px 0 0; width: 50%; vertical-align: top;">
          ${leftContent}
        </td>
        <td style="padding: 0 0 0 10px; width: 50%; vertical-align: top;">
          ${rightContent}
        </td>
      </tr>
    </table>
    <!--[if mso]>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td width="50%" style="padding: 0 10px 0 0; vertical-align: top;">
          ${leftContent}
        </td>
        <td width="50%" style="padding: 0 0 0 10px; vertical-align: top;">
          ${rightContent}
        </td>
      </tr>
    </table>
    <![endif]-->
  `.trim();
}

/**
 * Creates a responsive table for participant lists
 */
export function createParticipantTable(participants: Array<{ name: string; email?: string }>): string {
  if (participants.length === 0) {
    return createInfoBox('No participants found.', 'info');
  }

  const rows = participants.map(p => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 15px;">
        ${p.name}
      </td>
      ${p.email ? `
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        ${p.email}
      </td>
      ` : ''}
    </tr>
  `).join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; border-collapse: collapse; background-color: #ffffff; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-size: 14px; font-weight: 600;">
            Name
          </th>
          ${participants[0]?.email ? `
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-size: 14px; font-weight: 600;">
            Email
          </th>
          ` : ''}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `.trim();
}

