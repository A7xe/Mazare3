export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = {
  ok: boolean;
  /** Provider did not attempt network (none / foundation phase). */
  skipped?: boolean;
  providerRef?: string;
  errorMessage?: string;
};

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
