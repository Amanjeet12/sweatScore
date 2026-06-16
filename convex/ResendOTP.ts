import { Email } from '@convex-dev/auth/providers/Email';
import { alphabet, generateRandomString } from 'oslo/crypto';

import { OTP_EMAIL_TEMPLATE, renderTemplate } from './emailTemplates';

export const ResendOTP = Email({
  id: 'resend-otp',
  apiKey: process.env.BASIC_AUTH_PASSWORD, // Using basic auth password as apiKey for compatibility
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  generateVerificationToken() {
    return generateRandomString(4, alphabet('0-9'));
  },
  async sendVerificationRequest({
    identifier: email,
    provider,
    token,
  }: {
    identifier: string;
    provider: any;
    token: string;
  }) {
    // Render the template with data
    const html = renderTemplate(OTP_EMAIL_TEMPLATE, {
      code: token,
    });

    const credentials = btoa(
      `${process.env.BASIC_AUTH_USERNAME}:${process.env.BASIC_AUTH_PASSWORD}`
    );

    const response = await fetch(`${process.env.CONVEX_SITE_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        from: process.env.SMTP_FROM,
        to: [email],
        subject: 'Your SweatScore sign-in code',
        text: `Your code is ${token}. This code expires in 15 minutes.`,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(`Email sending failed: ${result.error}`);
    }
  },
});
