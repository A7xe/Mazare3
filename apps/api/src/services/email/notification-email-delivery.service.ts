import { prisma } from '@mazare3/db';
import type { NotificationItem } from '@mazare3/shared';
import { loadEmailConfig } from '../../config/email-config.js';
import { getEmailProvider } from './get-email-provider.js';
import type { EmailTemplateId, EmailTemplateVariables } from './templates/index.js';
import { renderEmailTemplate } from './templates/index.js';
import { maskEmail, sanitizeDeliveryErrorMessage } from '../../lib/mask-email.js';

type CreateEmailDeliveryLogInput = {
  notification: NotificationItem;
  templateId: EmailTemplateId;
  vars: EmailTemplateVariables;
};

export async function createEmailDeliveryLogForNotification(
  input: CreateEmailDeliveryLogInput,
): Promise<void> {
  const userId = input.notification.userId;
  if (!userId) return;

  const existing = await prisma.notificationDelivery.findFirst({
    where: { notificationId: input.notification.id, channel: 'email' },
  });
  if (existing) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, locale: true },
  });
  if (!user?.email) return;

  const emailConfig = loadEmailConfig();
  const providerName = emailConfig.provider;
  const recipientMasked = maskEmail(user.email);

  try {
    if (providerName === 'none') {
      await prisma.notificationDelivery.create({
        data: {
          notificationId: input.notification.id,
          userId,
          channel: 'email',
          provider: 'none',
          recipientMasked,
          status: 'skipped',
          errorMessage: 'EMAIL_PROVIDER=none',
        },
      });
      return;
    }

    const template = renderEmailTemplate(
      input.templateId,
      user.locale,
      input.vars,
    );

    const provider = getEmailProvider(providerName);
    const result = await provider.send({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    const status = result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed';
    const errorMessage = result.errorMessage
      ? sanitizeDeliveryErrorMessage(result.errorMessage)
      : null;

    await prisma.notificationDelivery.create({
      data: {
        notificationId: input.notification.id,
        userId,
        channel: 'email',
        provider: providerName,
        recipientMasked,
        status,
        errorMessage,
        sentAt: result.ok ? new Date() : null,
      },
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? sanitizeDeliveryErrorMessage(err.message) : 'Email delivery error';
    await prisma.notificationDelivery.create({
      data: {
        notificationId: input.notification.id,
        userId,
        channel: 'email',
        provider: providerName,
        recipientMasked,
        status: 'failed',
        errorMessage,
      },
    });
  }
}

export async function emailTemplateVarsFromNotification(notification: NotificationItem): Promise<{}> {
  void notification;
  return {};
}

