'use client';

import { getApiBaseUrl } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  locale: string;
  status?: string;
  createdAt?: string;
  ownerProfileStatus?: string | null;
  ownerRejectionReason?: string | null;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function signup(data: {
  name?: string;
  email: string;
  password: string;
  locale?: string;
}) {
  return authFetch<{ data: { user: AuthUser } }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(data: { email: string; password: string }) {
  return authFetch<{ data: { user: AuthUser } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return authFetch<{ data: { success: boolean } }>('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return authFetch<{ data: { user: AuthUser } }>('/auth/me');
}

export async function refreshSession() {
  return authFetch<{ data: { user: AuthUser } }>('/auth/refresh-session', { method: 'POST' });
}
