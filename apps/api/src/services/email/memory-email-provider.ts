import { isMemoryEmailAllowed } from '../../config/email-config.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

export type CapturedEmailMessage = EmailMessage & {
  createdAt: string;
  providerRef: string;
};

const MAX_OUTBOX = 50;
const outbox: CapturedEmailMessage[] = [];
let seq = 0;

/** Local/QA only — captures outgoing mail for deterministic E2E. Never production. */
export class MemoryEmailProvider implements EmailProvider {
  readonly name = 'memory';

  isConfigured(): boolean {
    return isMemoryEmailAllowed();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'Memory email provider is not allowed in production',
      };
    }

    seq += 1;
    const providerRef = `memory_${seq}_${Date.now()}`;
    outbox.push({
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      createdAt: new Date().toISOString(),
      providerRef,
    });
    while (outbox.length > MAX_OUTBOX) outbox.shift();

    return { ok: true, providerRef };
  }
}

export function getMemoryEmailOutbox(): CapturedEmailMessage[] {
  return [...outbox];
}

export function clearMemoryEmailOutbox(): void {
  outbox.length = 0;
}

export function getLastMemoryEmail(): CapturedEmailMessage | undefined {
  return outbox.length ? outbox[outbox.length - 1] : undefined;
}
