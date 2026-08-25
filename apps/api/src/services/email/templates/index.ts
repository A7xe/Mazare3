import { renderBookingConfirmed } from './booking-confirmed.js';
import { renderDisputeOpened } from './dispute-opened.js';
import { pickLocale } from './helpers.js';
import { renderOwnerApplicationApproved } from './owner-application-approved.js';
import { renderPaymentSucceeded } from './payment-succeeded.js';
import { renderPayoutMarkedPaid } from './payout-marked-paid.js';
import { renderPropertyPublished } from './property-published.js';
import { renderRefundRequested } from './refund-requested.js';
import type {
  EmailLocale,
  EmailTemplateId,
  EmailTemplateVariables,
  RenderedEmail,
} from './types.js';

export type { EmailTemplateId, EmailLocale, EmailTemplateVariables, RenderedEmail };

const RENDERERS: Record<
  EmailTemplateId,
  (locale: EmailLocale, vars: EmailTemplateVariables) => RenderedEmail
> = {
  booking_confirmed: renderBookingConfirmed,
  payment_succeeded: renderPaymentSucceeded,
  refund_requested: renderRefundRequested,
  dispute_opened: renderDisputeOpened,
  owner_application_approved: renderOwnerApplicationApproved,
  property_published: renderPropertyPublished,
  payout_marked_paid: renderPayoutMarkedPaid,
};

export function renderEmailTemplate(
  templateId: EmailTemplateId,
  locale: string | undefined,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const loc = pickLocale(locale);
  const render = RENDERERS[templateId];
  return render(loc, vars);
}
