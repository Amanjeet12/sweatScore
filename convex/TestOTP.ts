import { Email } from '@convex-dev/auth/providers/Email';

export const TestOTP = Email({
  id: 'test-otp',
  apiKey: 'test-key', // Using basic auth password as apiKey for compatibility
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  generateVerificationToken() {
    return process.env.TEST_ACCOUNT_OTP!;
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
    const isTestAccount = email === process.env.TEST_ACCOUNT_EMAIL;

    if (isTestAccount) {
      // For test accounts, just log the code (don't send email)
      console.log(`🧪 Test account login: ${email} - Code: ${token}`);
      return; // Skip email sending
    }

    // For non-test accounts, throw an error or handle differently
    throw new Error('This provider is only for test accounts');
  },
});
