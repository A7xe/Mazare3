export type SendOtpParams = {
  toE164: string;
  code: string;
  locale: 'ar' | 'en';
  expiresInMinutes: number;
};

export type SendOtpResult = {
  ok: boolean;
  skipped?: boolean;
  providerRef?: string;
  errorMessage?: string;
};

export interface SmsOtpProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendOtp(params: SendOtpParams): Promise<SendOtpResult>;
}

export function buildPhoneOtpSmsBody(
  locale: 'ar' | 'en',
  code: string,
  expiresInMinutes: number,
): string {
  if (locale === 'en') {
    return `Your Mazare3 verification code is: ${code}. It expires in ${expiresInMinutes} minutes.`;
  }
  return `رمز التحقق الخاص بك في مزارع هو: ${code}\nينتهي خلال ${expiresInMinutes} دقائق.`;
}
