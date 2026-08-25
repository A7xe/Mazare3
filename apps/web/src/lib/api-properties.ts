import type {
  MarketplaceDiscoveryResponse,
  PropertySearchQuery,
  PropertySearchResponse,
  PublicAvailabilitySlot,
  PublicPropertyDetail,
  PublicPropertySummary,
} from '@mazare3/shared';
import { serializePropertySearchQuery } from '@mazare3/shared';
import { apiFetch, getApiBaseUrl } from './api';

export type PropertySearchParams = Partial<PropertySearchQuery>;

function qs(params: PropertySearchParams): string {
  const s = serializePropertySearchQuery(params);
  return s ? `?${s}` : '';
}

export async function fetchProperties(
  params: PropertySearchParams = {},
): Promise<PublicPropertySummary[]> {
  const res = await fetchPropertySearch(params);
  return res.data;
}

export async function fetchPropertySearch(
  params: PropertySearchParams = {},
  options?: { signal?: AbortSignal },
): Promise<PropertySearchResponse> {
  return apiFetch<PropertySearchResponse>(`/properties${qs(params)}`, {
    cache: 'no-store',
    signal: options?.signal,
  });
}

export type PropertyTitleSuggestion = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  type: string;
  city: string;
};

/** Lightweight Explore autocomplete — no Recommended ranking. */
export async function fetchPropertySuggestions(
  q: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<PropertyTitleSuggestion[]> {
  const sp = new URLSearchParams();
  sp.set('q', q);
  if (options?.limit) sp.set('limit', String(options.limit));
  const res = await apiFetch<{ data: PropertyTitleSuggestion[] }>(
    `/properties/suggestions?${sp.toString()}`,
    { cache: 'no-store', signal: options?.signal },
  );
  return res.data;
}

export async function fetchDiscovery(
  params: Pick<
    PropertySearchParams,
    'city' | 'area' | 'date' | 'period' | 'guests' | 'lat' | 'lng'
  > = {},
): Promise<MarketplaceDiscoveryResponse> {
  const res = await apiFetch<{ data: MarketplaceDiscoveryResponse }>(
    `/properties/discovery${qs(params)}`,
    { cache: 'no-store' },
  );
  return res.data;
}

export async function fetchPropertyBySlug(slug: string): Promise<{
  property: PublicPropertyDetail;
  similar: PublicPropertySummary[];
}> {
  const res = await apiFetch<{
    data: PublicPropertyDetail;
    similar: PublicPropertySummary[];
  }>(`/properties/${slug}`, { cache: 'no-store' });
  return { property: res.data, similar: res.similar ?? [] };
}

/** Client-safe availability fetch (browser → API origin). */
export async function fetchPropertyAvailability(
  slug: string,
  from: string,
  to: string,
): Promise<PublicAvailabilitySlot[]> {
  const sp = new URLSearchParams({ from, to });
  const res = await fetch(`${getApiBaseUrl()}/properties/${slug}/availability?${sp}`, {
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? 'Failed to load availability');
  }
  return (body as { data: PublicAvailabilitySlot[] }).data;
}
