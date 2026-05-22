import type { PublicPropertyDetail, PublicPropertySummary } from '@mazare3/shared';
import { apiFetch } from './api';

export async function fetchProperties(): Promise<PublicPropertySummary[]> {
  const res = await apiFetch<{ data: PublicPropertySummary[] }>('/properties', {
    next: { revalidate: 30 },
  });
  return res.data;
}

export async function fetchPropertyBySlug(slug: string): Promise<{
  property: PublicPropertyDetail;
  similar: PublicPropertySummary[];
}> {
  const res = await apiFetch<{
    data: PublicPropertyDetail;
    similar: PublicPropertySummary[];
  }>(`/properties/${slug}`, { next: { revalidate: 30 } });
  return { property: res.data, similar: res.similar ?? [] };
}
