export type EmailTemplateId =
  | 'booking_confirmed'
  | 'payment_succeeded'
  | 'refund_requested'
  | 'dispute_opened'
  | 'owner_application_approved'
  | 'property_published'
  | 'payout_marked_paid';

export type EmailLocale = 'ar' | 'en';

export type EmailTemplateVariables = Record<string, string | number>;

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export type EmailTemplateDefinition = {
  id: EmailTemplateId;
  render(locale: EmailLocale, vars: EmailTemplateVariables): RenderedEmail;
};
