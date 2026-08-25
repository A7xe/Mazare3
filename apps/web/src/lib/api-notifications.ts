'use client';

import type { NotificationItem, NotificationListResult } from '@mazare3/shared';
import { getApiBaseUrl } from './api';

async function meFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }
  return body as T;
}

export async function fetchMyNotifications() {
  return meFetch<{ data: NotificationListResult }>('/me/notifications');
}

export async function markNotificationRead(id: string) {
  return meFetch<{ data: NotificationItem }>(`/me/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead() {
  return meFetch<{ data: { updated: number } }>('/me/notifications/read-all', {
    method: 'PATCH',
  });
}
