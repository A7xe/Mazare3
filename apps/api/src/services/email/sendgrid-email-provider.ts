import { isSendgridConfigured, loadEmailConfig } from '../../config/email-config.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

/** SendGrid foundation stub — no live API calls. AUTH-3 live send uses Resend. */
export class SendgridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';

  isConfigured(): boolean {
    return isSendgridConfigured(loadEmailConfig());
  }

  async send(_message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'SendGrid is not fully configured',
      };
    }
    return {
      ok: false,
      skipped: true,
      errorMessage: 'SendGrid send is disabled until a real provider rollout (Phase 9B foundation)',
    };
  }
}
