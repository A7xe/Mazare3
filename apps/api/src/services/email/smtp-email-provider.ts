import { isSmtpConfigured, loadEmailConfig } from '../../config/email-config.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

/** SMTP foundation stub — env validation only. AUTH-3 live send uses Resend. */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';

  isConfigured(): boolean {
    return isSmtpConfigured(loadEmailConfig());
  }

  async send(_message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'SMTP is not fully configured',
      };
    }
    return {
      ok: false,
      skipped: true,
      errorMessage: 'SMTP send is disabled until a real provider rollout (Phase 9B foundation)',
    };
  }
}
