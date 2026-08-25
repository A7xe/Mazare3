'use client';

import type { PublicPropertySummary } from '@mazare3/shared';
import { getApiBaseUrl } from './api';

async function favFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function fetchFavoriteIds() {
  return favFetch<{ data: { propertyIds: string[] } }>('/me/favorites/ids');
}

export async function fetchBookableFavorites() {
  return favFetch<{ data: PublicPropertySummary[] }>('/me/favorites');
}

export async function addFavorite(propertyId: string) {
  return favFetch<{ data: { favorited: boolean } }>(`/me/favorites/${propertyId}`, {
    method: 'POST',
  });
}

export async function removeFavorite(propertyId: string) {
  return favFetch<{ data: { favorited: boolean } }>(`/me/favorites/${propertyId}`, {
    method: 'DELETE',
  });
}
