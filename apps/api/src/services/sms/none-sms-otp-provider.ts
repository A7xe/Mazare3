import type { SendOtpParams, SendOtpResult, SmsOtpProvider } from './sms-otp-provider.interface.js';

/** Default — no SMS network. Never pretends delivery succeeded. */
export class NoneSmsOtpProvider implements SmsOtpProvider {
  readonly name = 'none';

  isConfigured(): boolean {
    return true;
  }

  async sendOtp(_params: SendOtpParams): Promise<SendOtpResult> {
    return {
      ok: false,
      skipped: true,
      errorMessage: 'SMS_OTP_PROVIDER=none',
    };
  }
}
