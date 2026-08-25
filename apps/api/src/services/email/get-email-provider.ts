import { loadEmailConfig, type EmailProviderName } from '../../config/email-config.js';
import type { EmailProvider } from './email-provider.interface.js';
import { NoneEmailProvider } from './none-email-provider.js';
import { ResendEmailProvider } from './resend-email-provider.js';
import { SendgridEmailProvider } from './sendgrid-email-provider.js';
import { SmtpEmailProvider } from './smtp-email-provider.js';

const noneProvider = new NoneEmailProvider();
const smtpProvider = new SmtpEmailProvider();
const resendProvider = new ResendEmailProvider();
const sendgridProvider = new SendgridEmailProvider();

export function getEmailProvider(name?: EmailProviderName): EmailProvider {
  const provider = name ?? loadEmailConfig().provider;
  switch (provider) {
    case 'smtp':
      return smtpProvider;
    case 'resend':
      return resendProvider;
    case 'sendgrid':
      return sendgridProvider;
    default:
      return noneProvider;
  }
}
