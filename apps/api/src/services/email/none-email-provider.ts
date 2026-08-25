import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

export class NoneEmailProvider implements EmailProvider {
  readonly name = 'none';

  isConfigured(): boolean {
    return true;
  }

  async send(_message: EmailMessage): Promise<EmailSendResult> {
    return { ok: false, skipped: true, errorMessage: 'EMAIL_PROVIDER=none' };
  }
}
