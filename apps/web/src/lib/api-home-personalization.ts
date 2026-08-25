'use client';

import { getApiBaseUrl } from './api';
import type { HomePersonalizationResponse } from '@mazare3/shared';

export async function fetchHomePersonalization(): Promise<HomePersonalizationResponse | null> {
  const res = await fetch(`${getApiBaseUrl()}/me/home-personalization`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { data: HomePersonalizationResponse };
  return body.data;
}
