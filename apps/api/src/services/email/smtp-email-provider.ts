import { isSmtpConfigured, loadEmailConfig } from '../../config/email-config.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

/** SMTP placeholder — validates env only; does not open network connections in Phase 9B. */
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
