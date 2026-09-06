import type { Locale, PublicPropertySummary } from '@mazare3/shared';
import {
  getOfferUrgencyKey,
  hasTruthfulPriceAnchor,
  resolveCardOfferPricing,
  resolveOfferBadgeKind,
  type OfferBadgeKind,
  type OfferUrgencyKey,
  type CardOfferPricing,
} from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';

export type { OfferUrgencyKey, CardOfferPricing };

export type OfferBadgeResolution =
  | { kind: 'percent'; percent: number }
  | { kind: 'save'; amountLabel: string }
  | { kind: 'fallback' };

/** Approved Homepage Offers palette — reuse exactly; do not fork. */
export const OFFER_VISUAL = {
  blue: '#2F6EF6',
  navy: '#0D2046',
  amber: '#F59E0B',
  amberText: '#1A1205',
  amberDeep: '#B45309',
  amberUrgency: '#92400E',
  warmBorder: '#F0D9A8',
  warmIconBg: '#FFF7E6',
  sectionGradient: 'linear-gradient(165deg,#FFFBF5_0%,#F7FBFF_48%,#EEF5FF_100%)',
} as const;

export const offerSectionShellClass =
  'relative overflow-hidden border border-[#F0D9A8]/90 bg-[linear-gradient(165deg,#FFFBF5_0%,#F7FBFF_48%,#EEF5FF_100%)] shadow-[0_8px_28px_rgba(47,110,246,.08)]';

export const offerCardChromeClass =
  'border border-[#F0D9A8]/95 bg-white shadow-[0_6px_16px_rgba(180,83,9,.08)] transition-[box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_10px_22px_rgba(180,83,9,.12)]';

export const offerBadgeClass =
  'rounded-[7px] bg-[#F59E0B] px-1.5 py-0.5 text-[8.5px] font-bold text-[#1A1205] shadow-[0_2px_8px_rgba(245,158,11,.35)]';

export const offerIconChipClass =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[#FFF7E6] text-[#B45309] ring-1 ring-[#F59E0B]/35';

export { getOfferUrgencyKey, hasTruthfulPriceAnchor, resolveCardOfferPricing };

export function resolveOfferBadge(
  property: PublicPropertySummary,
  locale: Locale,
): OfferBadgeResolution | null {
  const kind = resolveOfferBadgeKind(property);
  if (!kind) return null;
  return formatOfferBadgeKind(kind, property.currency, locale);
}

function formatOfferBadgeKind(
  kind: OfferBadgeKind,
  currency: string,
  locale: Locale,
): OfferBadgeResolution {
  if (kind.kind === 'percent') return { kind: 'percent', percent: kind.percent };
  if (kind.kind === 'save') {
    return { kind: 'save', amountLabel: formatPrice(kind.amount, currency, locale) };
  }
  return { kind: 'fallback' };
}
