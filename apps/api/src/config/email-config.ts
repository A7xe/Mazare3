import { getAppEnv, isAppEnvProduction } from './app-env.js';

export type EmailProviderName = 'none' | 'smtp' | 'resend' | 'sendgrid';

export type EmailConfig = {
  provider: EmailProviderName;
  from: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  resendApiKey: string;
  sendgridApiKey: string;
};

function parseProvider(raw: string | undefined): EmailProviderName {
  const v = (raw ?? 'none').trim().toLowerCase();
  if (v === 'smtp' || v === 'resend' || v === 'sendgrid') return v;
  return 'none';
}

function parsePort(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 587;
}

export function loadEmailConfig(): EmailConfig {
  return {
    provider: parseProvider(process.env.EMAIL_PROVIDER),
    from: (process.env.EMAIL_FROM ?? '').trim(),
    smtp: {
      host: (process.env.SMTP_HOST ?? '').trim(),
      port: parsePort(process.env.SMTP_PORT),
      user: (process.env.SMTP_USER ?? '').trim(),
      pass: (process.env.SMTP_PASS ?? '').trim(),
    },
    resendApiKey: (process.env.RESEND_API_KEY ?? '').trim(),
    sendgridApiKey: (process.env.SENDGRID_API_KEY ?? '').trim(),
  };
}

export function isSmtpConfigured(config: EmailConfig): boolean {
  return Boolean(
    config.smtp.host && config.smtp.user && config.smtp.pass && config.from,
  );
}

export function isResendConfigured(config: EmailConfig): boolean {
  return Boolean(config.resendApiKey && config.from);
}

export function isSendgridConfigured(config: EmailConfig): boolean {
  return Boolean(config.sendgridApiKey && config.from);
}

export function isEmailProviderConfigured(config: EmailConfig): boolean {
  switch (config.provider) {
    case 'smtp':
      return isSmtpConfigured(config);
    case 'resend':
      return isResendConfigured(config);
    case 'sendgrid':
      return isSendgridConfigured(config);
    default:
      return false;
  }
}

/** Safe user-facing reason when provider is selected but env is incomplete. */
export function missingProviderConfigReason(config: EmailConfig): string | null {
  if (config.provider === 'none') return null;
  if (isEmailProviderConfigured(config)) return null;
  switch (config.provider) {
    case 'smtp':
      return 'SMTP provider selected but SMTP_HOST, SMTP_USER, SMTP_PASS, or EMAIL_FROM is missing';
    case 'resend':
      return 'Resend provider selected but RESEND_API_KEY or EMAIL_FROM is missing';
    case 'sendgrid':
      return 'SendGrid provider selected but SENDGRID_API_KEY or EMAIL_FROM is missing';
    default:
      return 'Email provider configuration is incomplete';
  }
}

/** In production, misconfigured provider is an error; in local/staging we skip safely. */
export function shouldFailOnMisconfiguredProvider(config: EmailConfig): boolean {
  return config.provider !== 'none' && isAppEnvProduction() && !isEmailProviderConfigured(config);
}

export function getAppEnvLabel(): string {
  return getAppEnv();
}
