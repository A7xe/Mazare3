import { RECENTLY_ADDED_WINDOW_DAYS } from './constants';
import type { MarketplaceDiscoveryResponse, PublicPropertySummary } from './types';
import type { PropertySearchQuery } from './schemas/property-search';

export type ExploreCampaignId = 'offers' | 'newlyAdded' | 'overnight' | 'featured';

export type ExploreCampaignTileModel = {
  id: ExploreCampaignId;
  /** Canonical search params for this campaign (shareable URL). */
  params: Partial<PropertySearchQuery>;
  imageUrl?: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Cutoff for truthful newly-added / campaign New filter (`createdAt` only). */
export function recentlyAddedCreatedAtCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RECENTLY_ADDED_WINDOW_DAYS * MS_PER_DAY);
}

/** True when `createdAt` is within the shared recently-added window. */
export function isNewlyAddedCreatedAt(
  createdAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!createdAt) return false;
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() >= recentlyAddedCreatedAtCutoff(now).getTime();
}

/**
 * Booking-compatible base for campaign deep-links.
 * Clears other campaign dimensions so one campaign defines the candidate set.
 */
export function buildExploreCampaignSearchParams(
  base: Partial<PropertySearchQuery>,
  campaign: ExploreCampaignId,
): Partial<PropertySearchQuery> {
  const shared: Partial<PropertySearchQuery> = {
    city: base.city,
    area: base.area,
    date: base.date,
    period: base.period,
    guests: base.guests,
    lat: base.lat,
    lng: base.lng,
    sort: base.sort && base.sort !== 'recommended' ? base.sort : undefined,
    page: 1,
    q: undefined,
    offersOnly: undefined,
    newlyAdded: undefined,
    featured: undefined,
    allowsOvernight: undefined,
  };

  switch (campaign) {
    case 'offers':
      return { ...shared, offersOnly: true };
    case 'newlyAdded':
      return { ...shared, newlyAdded: true };
    case 'overnight':
      return { ...shared, allowsOvernight: true };
    case 'featured':
      return { ...shared, featured: true };
    default:
      return shared;
  }
}

function sectionProperties(
  discovery: MarketplaceDiscoveryResponse | null | undefined,
  id: string,
): PublicPropertySummary[] {
  return discovery?.sections.find((s) => s.id === id)?.properties ?? [];
}

/**
 * Build visible Explore campaign tiles from discovery payload.
 * Prefers server `campaignTiles` hints; falls back to discovery sections.
 */
export function buildExploreCampaignTiles(
  discovery: MarketplaceDiscoveryResponse | null | undefined,
  base: Partial<PropertySearchQuery>,
): ExploreCampaignTileModel[] {
  const hints = discovery?.campaignTiles;
  const offers = sectionProperties(discovery, 'offers');
  const featured = sectionProperties(discovery, 'featured');
  const newlyAdded = sectionProperties(discovery, 'recentlyAdded');

  const tiles: ExploreCampaignTileModel[] = [];

  const showOffers = Boolean(hints?.offers) || offers.length > 0;
  if (showOffers) {
    tiles.push({
      id: 'offers',
      params: buildExploreCampaignSearchParams(base, 'offers'),
      imageUrl: hints?.offers?.imageUrl ?? offers[0]?.imageUrl ?? null,
    });
  }

  const showNew = Boolean(hints?.newlyAdded) || newlyAdded.length > 0;
  if (showNew) {
    tiles.push({
      id: 'newlyAdded',
      params: buildExploreCampaignSearchParams(base, 'newlyAdded'),
      imageUrl: hints?.newlyAdded?.imageUrl ?? newlyAdded[0]?.imageUrl ?? null,
    });
  }

  const showOvernight = Boolean(hints?.overnight);
  if (showOvernight) {
    tiles.push({
      id: 'overnight',
      params: buildExploreCampaignSearchParams(base, 'overnight'),
      imageUrl: hints?.overnight?.imageUrl ?? null,
    });
  }

  const showFeatured = Boolean(hints?.featured) || featured.length > 0;
  if (showFeatured) {
    tiles.push({
      id: 'featured',
      params: buildExploreCampaignSearchParams(base, 'featured'),
      imageUrl: hints?.featured?.imageUrl ?? featured[0]?.imageUrl ?? null,
    });
  }

  return tiles;
}
