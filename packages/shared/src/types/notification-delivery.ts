export type NotificationDeliveryStatus = 'skipped' | 'queued' | 'sent' | 'failed';

export interface NotificationDeliveryRow {
  id: string;
  notificationId: string | null;
  userId: string | null;
  channel: 'email';
  provider: string;
  recipientMasked: string;
  status: NotificationDeliveryStatus;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}
