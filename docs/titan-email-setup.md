# Titan Email Setup Guide

This guide will help you configure Titan.email for sending notifications from your NFL Football Pool application.

## Prerequisites

1. A Titan.email account with an active email address
2. Access to your Titan email account settings
3. Your email password

## Important: Enable Third-Party Email Access

**Before configuring your app, you must enable third-party email access in your Titan account:**

1. Log in to your Titan email account at [https://titan.email](https://titan.email)
2. Go to **Settings** → **Security** or **Account Settings**
3. Enable **"Third-Party Email Access"** or **"IMAP/POP Access"**
4. **Disable Two-Factor Authentication (2FA)** if enabled, as it blocks third-party client access
5. Save your changes

> **Note:** If your Titan account is managed through GoDaddy, Blacknight, MonoVM, DomainDiscount24, Fluccs, or Domain Central, you may need to contact your provider for assistance with IMAP/POP setup.

## SMTP Configuration Settings

For sending emails from your application, use these SMTP settings:

- **SMTP Server:** `smtp.titan.email`
- **Port:** `465`
- **Encryption:** SSL/TLS (secure connection)
- **Username:** Your full Titan email address (e.g., `jack@yourdomain.com`)
- **Password:** Your Titan email password

## Step-by-Step Setup

### 1. Create or Update `.env.local` File

Create a `.env.local` file in the root of your project (if it doesn't exist) or update the existing one with the following configuration:

```env
# Titan Email Configuration
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_USER=your_email@yourdomain.com
SMTP_PASS=your_email_password
SMTP_FROM=your_email@yourdomain.com
```

Replace the following values:
- `your_email@yourdomain.com` - Your full Titan email address
- `your_email_password` - Your Titan email account password

### 2. Example Configuration

Here's an example with actual values:

```env
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_USER=admin@myfootballpool.com
SMTP_PASS=MySecurePassword123!
SMTP_FROM=admin@myfootballpool.com
```

### 3. Test Your Configuration

Run the email test script to verify your configuration:

```bash
npm run test:email
```

Or directly:

```bash
node scripts/test-email.mjs
```

This will:
- Verify your SMTP connection
- Send a test email to your own address
- Display any configuration errors

### 4. Verify the Test Email

Check your Titan email inbox for the test email. If you receive it, your configuration is working correctly!

## Troubleshooting

### Authentication Failed (EAUTH)

**Symptoms:** Error message: "Invalid login" or "Authentication failed"

**Solutions:**
- Verify your email address and password are correct
- Ensure third-party email access is enabled in your Titan account
- Make sure 2FA is disabled
- Try resetting your email password in Titan settings

### Connection Failed (ECONNECTION)

**Symptoms:** Error message: "Connection refused" or "Cannot connect to server"

**Solutions:**
- Verify `smtp.titan.email` is the correct SMTP host
- Check your internet connection
- Ensure port 465 is not blocked by your firewall
- Try using port 587 with TLS (though Titan recommends 465 with SSL)

### Connection Timeout (ETIMEDOUT)

**Symptoms:** Error message: "Connection timeout"

**Solutions:**
- Check your internet connection
- Verify Titan's SMTP server is accessible
- Check if your hosting provider blocks outgoing SMTP connections
- Contact Titan support if the issue persists

### Emails Not Being Received

**Solutions:**
- Check your spam/junk folder
- Verify the recipient email address is correct
- Check Titan email account for any delivery issues
- Review application logs for email sending errors

## Additional Notes

### Port Configuration

- **Port 465:** Uses SSL/TLS encryption (recommended for Titan)
- **Port 587:** Uses STARTTLS encryption (alternative, but Titan recommends 465)

The application automatically detects port 465 and enables secure mode.

### Security Best Practices

1. **Never commit `.env.local` to version control** - It contains sensitive credentials
2. **Use a strong email password** - Your email password should be unique and secure
3. **Regularly update your password** - Change your email password periodically
4. **Monitor email activity** - Check your Titan account for any suspicious activity

### Provider-Specific Notes

If your Titan account is managed through:
- **GoDaddy:** Contact GoDaddy Support for IMAP/POP setup assistance
- **Blacknight, MonoVM, DomainDiscount24, Fluccs, or Domain Central:** See [Titan's EU-hosted users guide](https://support.titan.email/hc/en-us/articles/4406867379865-Configure-Titan-on-other-apps-using-IMAP-POP-for-EU-hosted-users)

## Getting Help

If you encounter issues:

1. **Check Titan Support:** [support.titan.email](mailto:support@titan.email)
2. **Review Titan Documentation:** [Titan Help Center](https://support.titan.email)
3. **Check Application Logs:** Look for error messages in your application console
4. **Test Configuration:** Run the test script to identify specific issues

## Related Documentation

- [Email Templates Guide](./email-templates.md) - Learn about available email templates
- [Environment Variables](./README.md) - General environment configuration

## Next Steps

Once your email is configured:

1. ✅ Test your configuration using the test script
2. ✅ Send a test email to verify delivery
3. ✅ Configure email templates in the admin dashboard
4. ✅ Start sending pool invitations and reminders!

---

**Last Updated:** Based on Titan.email documentation as of 2024
**Reference:** [Titan IMAP/POP Configuration Guide](https://support.titan.email/hc/en-us/articles/900000215446-Configure-Titan-on-other-apps-using-IMAP-POP)

