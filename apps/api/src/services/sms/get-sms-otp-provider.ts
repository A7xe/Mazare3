import { getSmsOtpProviderName } from '../../config/phone-otp-config.js';
import { isAppEnvProduction } from '../../config/app-env.js';
import { AppError } from '../../lib/errors.js';
import { MemorySmsOtpProvider } from './memory-sms-otp-provider.js';
import { NoneSmsOtpProvider } from './none-sms-otp-provider.js';
import type { SmsOtpProvider } from './sms-otp-provider.interface.js';

let cached: SmsOtpProvider | null = null;

export function getSmsOtpProvider(): SmsOtpProvider {
  if (cached) return cached;

  const name = getSmsOtpProviderName();
  if (name === 'memory') {
    if (isAppEnvProduction()) {
      throw new AppError(
        503,
        'PHONE_AUTH_UNAVAILABLE',
        'Phone authentication is temporarily unavailable',
      );
    }
    cached = new MemorySmsOtpProvider();
    return cached;
  }

  cached = new NoneSmsOtpProvider();
  return cached;
}

/** Test helper — reset provider cache between QA runs. */
export function resetSmsOtpProviderCacheForQa(): void {
  cached = null;
}
