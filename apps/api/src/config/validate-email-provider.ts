import { isAppEnvProduction } from './app-env.js';
import {
  getEmailSafeDiagnostics,
  isLiveEmailDeliverySupported,
  loadEmailConfig,
  missingProviderConfigReason,
  shouldFailOnMisconfiguredProvider,
  type EmailConfig,
} from './email-config.js';

export class EmailProviderStartupError extends Error {
  readonly code = 'EMAIL_PROVIDER_MISCONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'EmailProviderStartupError';
  }
}

/**
 * Production-safe email startup checks.
 * - Resend with missing credentials → hard fail on APP_ENV=production
 * - SMTP / SendGrid selected on production → hard fail (stubs, not live)
 * - memory on production → hard fail
 * - none on production → warning only (password recovery email unavailable)
 */
export function validateEmailProviderAtStartup(): void {
  const config = loadEmailConfig();
  const errors = collectEmailProviderStartupErrors(config);

  if (errors.length > 0) {
    throw new EmailProviderStartupError(
      `Email provider misconfigured:\n- ${errors.join('\n- ')}`,
    );
  }

  logEmailStartupDiagnostics(config);
}

export function collectEmailProviderStartupErrors(config: EmailConfig = loadEmailConfig()): string[] {
  const errors: string[] = [];

  if (config.provider === 'memory' && isAppEnvProduction()) {
    errors.push('EMAIL_PROVIDER=memory is forbidden when APP_ENV=production');
  }

  if (
    isAppEnvProduction() &&
    (config.provider === 'smtp' || config.provider === 'sendgrid')
  ) {
    errors.push(
      `EMAIL_PROVIDER=${config.provider} is not production-capable yet; use EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM`,
    );
  }

  if (shouldFailOnMisconfiguredProvider(config)) {
    errors.push(missingProviderConfigReason(config) ?? 'Email provider configuration is incomplete');
  }

  if (
    isAppEnvProduction() &&
    config.provider === 'resend' &&
    !isLiveEmailDeliverySupported('resend')
  ) {
    errors.push('Resend live delivery is not available');
  }

  return errors;
}

function logEmailStartupDiagnostics(config: EmailConfig): void {
  const diag = getEmailSafeDiagnostics(config);

  if (config.provider === 'none') {
    const level = isAppEnvProduction() ? 'warn' : 'log';
    console[level](
      '[api] email: EMAIL_PROVIDER=none — transactional password-recovery email delivery unavailable',
    );
    return;
  }

  console.log('[api] email', diag);

  if (!diag.configured && !isAppEnvProduction()) {
    const reason = missingProviderConfigReason(config);
    if (reason) {
      console.warn(`[api] email: ${reason} (sends will be skipped until configured)`);
    }
  }
}
