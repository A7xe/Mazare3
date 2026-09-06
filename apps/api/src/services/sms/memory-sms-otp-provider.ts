import { isAppEnvProduction } from '../../config/app-env.js';
import { buildPhoneOtpSmsBody, type SendOtpParams, type SendOtpResult, type SmsOtpProvider } from './sms-otp-provider.interface.js';

export type CapturedSmsOtp = {
  toE164: string;
  code: string;
  locale: 'ar' | 'en';
  body: string;
  createdAt: string;
  providerRef: string;
};

const MAX_OUTBOX = 50;
const outbox: CapturedSmsOtp[] = [];
let seq = 0;

export function isMemorySmsOtpAllowed(): boolean {
  if (isAppEnvProduction()) return false;
  return true;
}

/** LOCAL/QA ONLY — captures OTP in memory for gated E2E. Forbidden in production. */
export class MemorySmsOtpProvider implements SmsOtpProvider {
  readonly name = 'memory';

  isConfigured(): boolean {
    return isMemorySmsOtpAllowed();
  }

  async sendOtp(params: SendOtpParams): Promise<SendOtpResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'Memory SMS OTP provider is not allowed in production',
      };
    }

    seq += 1;
    const providerRef = `sms_memory_${seq}_${Date.now()}`;
    const body = buildPhoneOtpSmsBody(params.locale, params.code, params.expiresInMinutes);
    outbox.push({
      toE164: params.toE164,
      code: params.code,
      locale: params.locale,
      body,
      createdAt: new Date().toISOString(),
      providerRef,
    });
    while (outbox.length > MAX_OUTBOX) outbox.shift();

    return { ok: true, providerRef };
  }
}

export function getMemorySmsOtpOutbox(): CapturedSmsOtp[] {
  return [...outbox];
}

export function clearMemorySmsOtpOutbox(): void {
  outbox.length = 0;
}

export function getLastMemorySmsOtpForPhone(toE164: string): CapturedSmsOtp | undefined {
  for (let i = outbox.length - 1; i >= 0; i -= 1) {
    const row = outbox[i];
    if (row && row.toE164 === toE164) return row;
  }
  return undefined;
}
