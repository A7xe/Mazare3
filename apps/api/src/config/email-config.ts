import { getAppEnv, isAppEnvProduction } from './app-env.js';

/**
 * Transactional email configuration.
 * AUTH-3: Resend is the only production-capable live provider.
 * SMTP / SendGrid remain foundation stubs (not live send).
 * `memory` is local/QA capture only — never production.
 */
export type EmailProviderName = 'none' | 'smtp' | 'resend' | 'sendgrid' | 'memory';

export type EmailConfig = {
  provider: EmailProviderName;
  from: string;
  fromName: string;
  /** Network timeout for live provider HTTP calls (ms). */
  timeoutMs: number;
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
  if (v === 'smtp' || v === 'resend' || v === 'sendgrid' || v === 'memory') return v;
  return 'none';
}

function parsePort(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 587;
}

function parseTimeoutMs(raw: string | undefined): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1000 && n <= 60_000) return Math.floor(n);
  return 10_000;
}

export function loadEmailConfig(): EmailConfig {
  return {
    provider: parseProvider(process.env.EMAIL_PROVIDER),
    from: (process.env.EMAIL_FROM ?? '').trim(),
    fromName: (process.env.EMAIL_FROM_NAME ?? '').trim(),
    timeoutMs: parseTimeoutMs(process.env.EMAIL_TIMEOUT_MS),
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

/** RFC-style From header. Prefer "Name <email>" when EMAIL_FROM_NAME is set. */
export function formatEmailFromHeader(config: EmailConfig): string {
  if (!config.from) return '';
  if (!config.fromName) return config.from;
  const safeName = config.fromName.replace(/[<>\r\n"]/g, '').trim();
  if (!safeName) return config.from;
  return `${safeName} <${config.from}>`;
}

export function isSmtpConfigured(config: EmailConfig): boolean {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.from);
}

export function isResendConfigured(config: EmailConfig): boolean {
  return Boolean(config.resendApiKey && config.from);
}

export function isSendgridConfigured(config: EmailConfig): boolean {
  return Boolean(config.sendgridApiKey && config.from);
}

/** Live HTTP send is implemented for Resend only (AUTH-3). */
export function isLiveEmailDeliverySupported(provider: EmailProviderName): boolean {
  return provider === 'resend';
}

/** In-process capture for local/QA — never allowed on APP_ENV=production. */
export function isMemoryEmailAllowed(): boolean {
  return !isAppEnvProduction();
}

export function isEmailProviderConfigured(config: EmailConfig): boolean {
  switch (config.provider) {
    case 'smtp':
      return isSmtpConfigured(config);
    case 'resend':
      return isResendConfigured(config);
    case 'sendgrid':
      return isSendgridConfigured(config);
    case 'memory':
      return isMemoryEmailAllowed();
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
    case 'memory':
      return 'Memory email provider is not allowed when APP_ENV=production';
    default:
      return 'Email provider configuration is incomplete';
  }
}

/** In production, misconfigured live provider is an error; in local/staging we skip safely. */
export function shouldFailOnMisconfiguredProvider(config: EmailConfig): boolean {
  return config.provider !== 'none' && isAppEnvProduction() && !isEmailProviderConfigured(config);
}

export function getAppEnvLabel(): string {
  return getAppEnv();
}

/** Safe diagnostics — never includes API keys. */
export function getEmailSafeDiagnostics(config: EmailConfig = loadEmailConfig()): {
  provider: EmailProviderName;
  configured: boolean;
  liveSupported: boolean;
  fromConfigured: boolean;
  fromNameConfigured: boolean;
} {
  return {
    provider: config.provider,
    configured: isEmailProviderConfigured(config),
    liveSupported: isLiveEmailDeliverySupported(config.provider),
    fromConfigured: Boolean(config.from),
    fromNameConfigured: Boolean(config.fromName),
  };
}
