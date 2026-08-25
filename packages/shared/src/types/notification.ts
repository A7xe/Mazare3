export interface NotificationItem {
  id: string;
  userId: string | null;
  roleTarget: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  href?: string | null;
}

export interface NotificationListResult {
  items: NotificationItem[];
  unreadCount: number;
}
