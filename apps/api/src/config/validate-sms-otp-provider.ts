import { isAppEnvProduction } from './app-env.js';
import { getSmsOtpProviderName } from './phone-otp-config.js';

export class SmsOtpProviderStartupError extends Error {
  readonly code = 'SMS_OTP_PROVIDER_MISCONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'SmsOtpProviderStartupError';
  }
}

/** Refuse memory SMS OTP in production. */
export function validateSmsOtpProviderAtStartup(): void {
  const name = getSmsOtpProviderName();
  if (isAppEnvProduction() && name === 'memory') {
    throw new SmsOtpProviderStartupError(
      'SMS_OTP_PROVIDER=memory is forbidden when APP_ENV=production',
    );
  }
  if (isAppEnvProduction() && name === 'none') {
    console.warn(
      '[api] sms: SMS_OTP_PROVIDER=none — phone OTP delivery unavailable in production until a live provider is configured',
    );
  }
}
