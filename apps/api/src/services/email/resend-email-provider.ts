import { isResendConfigured, loadEmailConfig } from '../../config/email-config.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

/** Resend placeholder — no API calls in Phase 9B. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  isConfigured(): boolean {
    return isResendConfigured(loadEmailConfig());
  }

  async send(_message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'Resend is not fully configured',
      };
    }
    return {
      ok: false,
      skipped: true,
      errorMessage: 'Resend send is disabled until a real provider rollout (Phase 9B foundation)',
    };
  }
}
