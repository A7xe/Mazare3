import {
  formatEmailFromHeader,
  isResendConfigured,
  loadEmailConfig,
} from '../../config/email-config.js';
import { sanitizeDeliveryErrorMessage } from '../../lib/mask-email.js';
import type { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

type ResendSuccessBody = { id?: string };
type ResendErrorBody = { message?: string; name?: string; statusCode?: number };

/**
 * Production-capable Resend adapter (AUTH-3).
 * Uses HTTPS fetch with a bounded timeout. No automatic retries.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  isConfigured(): boolean {
    return isResendConfigured(loadEmailConfig());
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const config = loadEmailConfig();
    if (!isResendConfigured(config)) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'Resend is not fully configured',
      };
    }

    const from = formatEmailFromHeader(config);
    if (!from) {
      return {
        ok: false,
        skipped: true,
        errorMessage: 'EMAIL_FROM is missing',
      };
    }

    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html ?? undefined,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (err) {
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError');
      return {
        ok: false,
        errorMessage: timedOut
          ? 'Resend request timed out'
          : 'Resend network error',
      };
    }

    let body: ResendSuccessBody & ResendErrorBody = {};
    try {
      body = (await response.json()) as ResendSuccessBody & ResendErrorBody;
    } catch {
      body = {};
    }

    if (!response.ok) {
      const raw =
        typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : `Resend HTTP ${response.status}`;
      return {
        ok: false,
        errorMessage: sanitizeDeliveryErrorMessage(raw),
      };
    }

    const providerRef = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined;
    return {
      ok: true,
      providerRef,
    };
  }
}
