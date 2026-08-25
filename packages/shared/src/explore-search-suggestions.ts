import { JORDAN_CITIES, PROPERTY_TYPES, type PropertyType } from './constants';
import type { PropertySearchQuery } from './schemas/property-search';

export const EXPLORE_SUGGESTION_LIMIT = 8;

export type ExploreSuggestionKind =
  | 'property'
  | 'city'
  | 'property_type'
  | 'amenity'
  | 'intent';

/** Structured marketplace suggestion (local / code-owned). */
export type ExploreLocalSuggestion = {
  id: string;
  kind: Exclude<ExploreSuggestionKind, 'property'>;
  /** Stable ranking bucket: higher = more useful when typed. */
  rank: number;
  labelAr: string;
  labelEn: string;
  /** Canonical Explore filters this suggestion applies. */
  params: Partial<PropertySearchQuery>;
  /** Aliases used for matching (already normalized). */
  aliases: string[];
};

export type ExplorePropertySuggestionInput = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string | null;
};

export type ExploreMergedSuggestion =
  | {
      id: string;
      kind: 'property';
      rank: number;
      label: string;
      slug: string;
      params?: undefined;
    }
  | {
      id: string;
      kind: Exclude<ExploreSuggestionKind, 'property'>;
      rank: number;
      label: string;
      labelAr: string;
      labelEn: string;
      params: Partial<PropertySearchQuery>;
      slug?: undefined;
    };

/**
 * Matching-only normalization: trim, collapse spaces, lower English,
 * light Arabic alef/ya/ta-marbuta folding. Does not mutate stored data.
 */
export function normalizeExploreSearchText(input: string): string {
  let s = input.trim().replace(/\s+/g, ' ');
  s = s.toLowerCase();
  // Arabic alef variants → ا
  s = s.replace(/[أإآٱ]/g, 'ا');
  // ta marbuta → ه for matching
  s = s.replace(/ة/g, 'ه');
  // alif maqsura → ي
  s = s.replace(/ى/g, 'ي');
  // strip tatweel + common harakat/tanween (matching only)
  s = s.replace(/\u0640/g, '');
  s = s.replace(/[\u064B-\u065F]/g, '');
  return s;
}

function aliases(...values: string[]): string[] {
  return [...new Set(values.map(normalizeExploreSearchText).filter(Boolean))];
}

function citySuggestions(): ExploreLocalSuggestion[] {
  return JORDAN_CITIES.map((c) => ({
    id: `city:${c.key}`,
    kind: 'city' as const,
    rank: 900,
    labelAr: c.labelAr,
    labelEn: c.labelEn,
    params: { city: c.key },
    aliases: aliases(c.key, c.labelAr, c.labelEn, c.key.replace(/_/g, ' ')),
  }));
}

function propertyTypeSuggestions(): ExploreLocalSuggestion[] {
  const defs: Array<{
    type: PropertyType;
    labelAr: string;
    labelEn: string;
    extra: string[];
  }> = [
    {
      type: 'farm',
      labelAr: 'مزرعة',
      labelEn: 'Farm',
      extra: ['مزرعة', 'مزارع', 'farm', 'farms'],
    },
    {
      type: 'chalet',
      labelAr: 'شاليه',
      labelEn: 'Chalet',
      extra: ['شاليه', 'شاليهات', 'chalet', 'chalets'],
    },
    {
      type: 'villa',
      labelAr: 'فيلا',
      labelEn: 'Villa',
      extra: ['فيلا', 'فلل', 'villa', 'villas'],
    },
    {
      type: 'istiraha',
      labelAr: 'استراحة',
      labelEn: 'Istiraha',
      extra: ['استراحة', 'استراحات', 'istiraha', 'istirahas'],
    },
    {
      type: 'private_resort',
      labelAr: 'منتجع خاص',
      labelEn: 'Private resort',
      extra: ['منتجع', 'منتجع خاص', 'private resort', 'resort'],
    },
    {
      type: 'pool_house',
      labelAr: 'بيت مسبح',
      labelEn: 'Pool house',
      extra: ['بيت مسبح', 'pool house', 'poolhouse'],
    },
  ];

  return defs
    .filter((d) => (PROPERTY_TYPES as readonly string[]).includes(d.type))
    .map((d) => ({
      id: `property_type:${d.type}`,
      kind: 'property_type' as const,
      rank: 800,
      labelAr: d.labelAr,
      labelEn: d.labelEn,
      params: { propertyType: d.type },
      aliases: aliases(d.type, d.labelAr, d.labelEn, ...d.extra),
    }));
}

/** Supported structured intents only (real filters — no Families). */
function amenityIntentSuggestions(): ExploreLocalSuggestion[] {
  return [
    {
      id: 'intent:hasPool',
      kind: 'amenity' as const,
      rank: 700,
      labelAr: 'مسبح خاص',
      labelEn: 'Private pool',
      params: { hasPool: true },
      aliases: aliases('مسبح', 'مسبح خاص', 'pool', 'private pool', 'hasPool', 'pools'),
    },
    {
      id: 'intent:football',
      kind: 'amenity' as const,
      rank: 700,
      labelAr: 'ملعب',
      labelEn: 'Playground',
      params: { amenities: ['football'] },
      aliases: aliases('ملعب', 'ملعب كرة', 'football', 'playground', 'soccer'),
    },
    {
      id: 'intent:allowsEvents',
      kind: 'intent' as const,
      rank: 700,
      labelAr: 'جلسات / مناسبات',
      labelEn: 'Events / lounges',
      params: { allowsEvents: true },
      aliases: aliases('جلسات', 'مناسبات', 'events', 'lounges', 'lounge', 'event'),
    },
    {
      id: 'intent:allowsOvernight',
      kind: 'intent' as const,
      rank: 650,
      labelAr: 'مبيت',
      labelEn: 'Overnight',
      params: { allowsOvernight: true },
      aliases: aliases('مبيت', 'overnight', 'overnight stay', 'sleepover'),
    },
  ];
}

let cachedCatalog: ExploreLocalSuggestion[] | null = null;

export function listExploreLocalSuggestionCatalog(): ExploreLocalSuggestion[] {
  if (!cachedCatalog) {
    cachedCatalog = [
      ...citySuggestions(),
      ...propertyTypeSuggestions(),
      ...amenityIntentSuggestions(),
    ];
  }
  return cachedCatalog;
}

/** Empty-focus quick intents: real supported filters only (no Families, no fake popular). */
export function listExploreQuickIntents(): ExploreLocalSuggestion[] {
  const ids = new Set([
    'property_type:chalet',
    'property_type:villa',
    'property_type:farm',
    'intent:hasPool',
    'intent:football',
    'intent:allowsEvents',
  ]);
  return listExploreLocalSuggestionCatalog().filter((s) => ids.has(s.id));
}

function matchStrength(normalizedQuery: string, alias: string): number {
  if (!normalizedQuery || !alias) return 0;
  if (alias === normalizedQuery) return 100;
  if (alias.startsWith(normalizedQuery)) return 80;
  if (normalizedQuery.startsWith(alias) && alias.length >= 2) return 70;
  if (alias.includes(normalizedQuery)) return 50;
  for (const part of alias.split(' ')) {
    if (part.startsWith(normalizedQuery) && normalizedQuery.length >= 2) return 75;
  }
  return 0;
}

/**
 * Conservative whole-query unique prefix → one structured catalog suggestion.
 * Used for autocomplete confidence and submit of short prefixes like `مزر`.
 * Ambiguous prefixes return null.
 */
export function resolveUniqueExplorePrefixSuggestion(
  rawQuery: string,
): ExploreLocalSuggestion | null {
  const q = normalizeExploreSearchText(rawQuery);
  if (q.length < 2) return null;
  if (/\s/.test(q)) return null;

  const hits = new Map<string, ExploreLocalSuggestion>();
  for (const item of listExploreLocalSuggestionCatalog()) {
    for (const alias of item.aliases) {
      if (alias === q || alias.startsWith(q)) {
        hits.set(item.id, item);
        break;
      }
    }
  }
  if (hits.size !== 1) return null;
  return [...hits.values()][0] ?? null;
}

export function matchExploreLocalSuggestions(
  rawQuery: string,
): Array<ExploreLocalSuggestion & { matchScore: number }> {
  const q = normalizeExploreSearchText(rawQuery);
  if (q.length < 1) return [];

  const hits: Array<ExploreLocalSuggestion & { matchScore: number }> = [];
  for (const item of listExploreLocalSuggestionCatalog()) {
    let best = 0;
    for (const alias of item.aliases) {
      best = Math.max(best, matchStrength(q, alias));
    }
    if (best > 0) hits.push({ ...item, matchScore: best });
  }

  return hits.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.id.localeCompare(b.id);
  });
}

/** Title relevance for property suggestion ranking (mirrors search service intent). */
export function propertyTitleMatchScore(
  rawQuery: string,
  titleAr: string,
  titleEn: string | null | undefined,
): number {
  const needle = normalizeExploreSearchText(rawQuery);
  if (!needle) return 0;
  const titles = [titleAr, titleEn ?? '']
    .map((t) => normalizeExploreSearchText(t))
    .filter(Boolean);
  let best = 0;
  for (const title of titles) {
    if (title === needle) best = Math.max(best, 1000);
    else if (title.startsWith(needle)) best = Math.max(best, 850 - Math.min(title.length, 200));
    else {
      const tokens = title.split(' ').filter(Boolean);
      for (const token of tokens) {
        if (token.startsWith(needle)) {
          best = Math.max(best, 720 - Math.min(token.length, 80));
        }
      }
      if (title.includes(needle)) {
        const idx = title.indexOf(needle);
        best = Math.max(best, 500 - idx);
      }
    }
  }
  return best;
}

/**
 * Merge local structured suggestions with property API hits.
 * Hierarchy: strong property name → city → type → amenity/intent → weaker property.
 */
export function mergeExploreSuggestions(params: {
  query: string;
  locale: 'ar' | 'en';
  properties: ExplorePropertySuggestionInput[];
  limit?: number;
}): ExploreMergedSuggestion[] {
  const limit = params.limit ?? EXPLORE_SUGGESTION_LIMIT;
  const local = matchExploreLocalSuggestions(params.query);
  const props = params.properties
    .map((p) => {
      const titleScore = propertyTitleMatchScore(params.query, p.titleAr, p.titleEn);
      return {
        id: `property:${p.id}`,
        kind: 'property' as const,
        // API already scoped to public eligible hits; non-title matches rank below structured intents.
        rank: titleScore > 0 ? titleScore : 200,
        label:
          params.locale === 'ar' ? p.titleAr : p.titleEn?.trim() ? p.titleEn : p.titleAr,
        slug: p.slug,
      };
    })
    .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));

  const strongProps = props.filter((p) => p.rank >= 800);
  const weakProps = props.filter((p) => p.rank < 800);

  const out: ExploreMergedSuggestion[] = [];
  const seen = new Set<string>();

  const push = (item: ExploreMergedSuggestion) => {
    if (out.length >= limit) return;
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  for (const p of strongProps) push(p);

  for (const s of local) {
    push({
      id: s.id,
      kind: s.kind,
      rank: s.rank + s.matchScore,
      label: params.locale === 'ar' ? s.labelAr : s.labelEn,
      labelAr: s.labelAr,
      labelEn: s.labelEn,
      params: s.params,
    });
  }

  for (const p of weakProps) push(p);

  return out.slice(0, limit);
}

/**
 * Build Explore URL params when applying a structured suggestion.
 * Clears free-text `q` and incompatible category filters; keeps browse context.
 */
export function applyExploreSuggestionParams(
  base: Partial<PropertySearchQuery>,
  suggestionParams: Partial<PropertySearchQuery>,
): Partial<PropertySearchQuery> {
  const next: Partial<PropertySearchQuery> = {
    city: base.city,
    area: base.area,
    date: base.date,
    period: base.period,
    guests: base.guests,
    sort: base.sort,
    lat: base.lat,
    lng: base.lng,
  };

  if (suggestionParams.city !== undefined) {
    next.city = suggestionParams.city;
    next.area = undefined;
  }
  if (suggestionParams.area !== undefined) next.area = suggestionParams.area;

  if (suggestionParams.propertyType !== undefined) {
    next.propertyType = suggestionParams.propertyType;
    next.hasPool = undefined;
    next.amenities = undefined;
    next.allowsEvents = undefined;
    next.allowsOvernight = undefined;
  }
  if (suggestionParams.hasPool !== undefined) {
    next.hasPool = suggestionParams.hasPool;
    next.propertyType = undefined;
    next.amenities = undefined;
    next.allowsEvents = undefined;
  }
  if (suggestionParams.amenities !== undefined) {
    next.amenities = suggestionParams.amenities;
    next.propertyType = undefined;
    next.hasPool = undefined;
    next.allowsEvents = undefined;
  }
  if (suggestionParams.allowsEvents !== undefined) {
    next.allowsEvents = suggestionParams.allowsEvents;
    next.propertyType = undefined;
    next.hasPool = undefined;
    next.amenities = undefined;
    next.allowsOvernight = undefined;
  }
  if (suggestionParams.allowsOvernight !== undefined) {
    next.allowsOvernight = suggestionParams.allowsOvernight;
    next.allowsEvents = undefined;
  }
  if (suggestionParams.q !== undefined) next.q = suggestionParams.q;

  // Structured intents are not free-text q searches.
  if (
    suggestionParams.city !== undefined ||
    suggestionParams.propertyType !== undefined ||
    suggestionParams.hasPool !== undefined ||
    suggestionParams.amenities !== undefined ||
    suggestionParams.allowsEvents !== undefined ||
    suggestionParams.allowsOvernight !== undefined
  ) {
    next.q = undefined;
  }

  return next;
}

/** True when a typed query matches a known unsupported fake intent (for tests / guardrails). */
export function isUnsupportedExploreIntent(rawQuery: string): boolean {
  const q = normalizeExploreSearchText(rawQuery);
  const fake = ['trending', 'most searched', 'الأكثر بحثا', 'عائلات فقط', 'families only fake'];
  if (!fake.includes(q)) return false;
  return matchExploreLocalSuggestions(rawQuery).length === 0;
}
