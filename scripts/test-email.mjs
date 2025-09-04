import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testEmail() {
  console.log('Testing Hostinger email configuration...\n');

  // Check if environment variables are set
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    console.log('\nPlease create a .env.local file with your Hostinger email settings.');
    console.log('See docs/hostinger-email-setup.md for instructions.');
    return;
  }

  console.log('✅ Environment variables found');
  console.log(`Host: ${process.env.SMTP_HOST}`);
  console.log(`Port: ${process.env.SMTP_PORT}`);
  console.log(`User: ${process.env.SMTP_USER}`);
  console.log(`From: ${process.env.SMTP_FROM}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('🔍 Testing connection...');
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📧 Sending test email...');
    
    const testEmail = {
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER, // Send to yourself for testing
      subject: 'NFL Football Pool - Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            🏈 NFL Football Pool - Email Test
          </h2>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">Email Configuration Test</h3>
            <p>This is a test email to verify your Hostinger email configuration is working correctly.</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>From:</strong> ${process.env.SMTP_FROM}</p>
            <p><strong>To:</strong> ${process.env.SMTP_USER}</p>
          </div>
          
          <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #166534; margin-top: 0;">✅ Success!</h4>
            <p style="color: #166534; margin: 0;">Your email configuration is working correctly. You can now send notifications from your NFL Football Pool application.</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated test email from your NFL Football Pool system.
            </p>
          </div>
        </div>
      `,
      text: `
NFL Football Pool - Email Test

Email Configuration Test

This is a test email to verify your Hostinger email configuration is working correctly.

Sent at: ${new Date().toLocaleString()}
From: ${process.env.SMTP_FROM}
To: ${process.env.SMTP_USER}

✅ Success!

Your email configuration is working correctly. You can now send notifications from your NFL Football Pool application.

This is an automated test email from your NFL Football Pool system.
      `
    };

    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    
    console.log('\n🎉 Your Hostinger email is configured correctly!');
    console.log('You can now use your application to send pool invitations, reminders, and notifications.');

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('- Your email address and password are correct');
      console.log('- You\'re using the right SMTP host');
      console.log('- Try using port 465 with SSL instead of 587 with TLS');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 Connection failed. Please check:');
      console.log('- Your SMTP host is correct');
      console.log('- Your hosting provider allows outgoing SMTP');
      console.log('- Try the alternative SMTP settings in the setup guide');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Connection timeout. Please check:');
      console.log('- Your internet connection');
      console.log('- Your hosting provider\'s SMTP server status');
    }
    
    console.log('\nFor more help, see docs/hostinger-email-setup.md');
  }
}

// Run the test
testEmail().catch(console.error);
