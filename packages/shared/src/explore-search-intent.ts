import type { PropertySearchQuery } from './schemas/property-search';
import {
  listExploreLocalSuggestionCatalog,
  normalizeExploreSearchText,
  resolveUniqueExplorePrefixSuggestion,
  type ExploreLocalSuggestion,
} from './explore-search-suggestions';

export type ExploreSearchIntentMatch = {
  id: string;
  kind: ExploreLocalSuggestion['kind'] | 'sort';
  alias: string;
  tokenStart: number;
  tokenEnd: number; // exclusive
};

export type ExploreSearchIntentParseResult = {
  /** Structured marketplace filters detected from free text. */
  params: Partial<PropertySearchQuery>;
  /** Leftover free-text for `q` after removing matched intents/orphaned fillers. */
  residualQuery?: string;
  matched: ExploreSearchIntentMatch[];
};

type AliasHit = ExploreSearchIntentMatch & {
  suggestion?: ExploreLocalSuggestion;
  sort?: PropertySearchQuery['sort'];
  aliasLen: number;
  rank: number;
};

/**
 * Connector/filler tokens that may be dropped ONLY when orphaned next to a
 * consumed structured match. Never stripped from unmatched free text globally.
 */
const FILLER_TOKENS = new Set(
  [
    'في',
    'ب',
    'مع',
    'و',
    'على',
    'من',
    'الى',
    'إلى',
    'ال',
    'ل',
    'فيه',
    'فيها',
    'بهم',
    'in',
    'with',
    'near',
    'at',
    'a',
    'an',
    'the',
    'and',
    'for',
    'of',
    'to',
  ].map(normalizeExploreSearchText),
);

/** Explicit sort intents (mutually exclusive). */
const SORT_INTENTS: Array<{
  id: string;
  sort: NonNullable<PropertySearchQuery['sort']>;
  aliases: string[];
  rank: number;
}> = [
  {
    id: 'sort:price_asc',
    sort: 'price_asc',
    aliases: ['رخيص', 'الأرخص', 'ارخص', 'أرخص', 'cheap', 'cheapest', 'lowest price'],
    rank: 600,
  },
  {
    id: 'sort:rating_desc',
    sort: 'rating_desc',
    aliases: [
      'الأعلى تقييما',
      'الاعلى تقييما',
      'أعلى تقييما',
      'اعلى تقييما',
      'top rated',
      'highest rated',
      'best rated',
    ],
    rank: 600,
  },
];

function tokenize(input: string): string[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether a single normalized token matches an alias, including common Arabic clitics:
 * بمسبح → مسبح, المزرعة → مزرعة, وملعب → ملعب
 */
export function exploreTokenMatchesAlias(tokenNorm: string, aliasNorm: string): boolean {
  if (!tokenNorm || !aliasNorm) return false;
  if (tokenNorm === aliasNorm) return true;
  const clitics = ['ب', 'ال', 'و', 'لل', 'بال'];
  for (const c of clitics) {
    if (tokenNorm === `${c}${aliasNorm}`) return true;
  }
  return false;
}

function windowMatchesAlias(normTokens: string[], start: number, aliasNorm: string): number {
  const aliasParts = aliasNorm.split(' ').filter(Boolean);
  if (!aliasParts.length) return 0;
  if (start + aliasParts.length > normTokens.length) return 0;

  if (aliasParts.length === 1) {
    return exploreTokenMatchesAlias(normTokens[start]!, aliasParts[0]!) ? 1 : 0;
  }

  for (let i = 0; i < aliasParts.length; i++) {
    const tok = normTokens[start + i]!;
    const part = aliasParts[i]!;
    if (i === 0) {
      if (!exploreTokenMatchesAlias(tok, part) && tok !== part) return 0;
    } else if (tok !== part && !exploreTokenMatchesAlias(tok, part)) {
      return 0;
    }
  }
  return aliasParts.length;
}

function collectHits(
  normTokens: string[],
  catalog: ExploreLocalSuggestion[],
): AliasHit[] {
  const hits: AliasHit[] = [];
  for (const suggestion of catalog) {
    for (const alias of suggestion.aliases) {
      const aliasNorm = normalizeExploreSearchText(alias);
      if (!aliasNorm) continue;
      for (let start = 0; start < normTokens.length; start++) {
        const span = windowMatchesAlias(normTokens, start, aliasNorm);
        if (!span) continue;
        hits.push({
          id: suggestion.id,
          kind: suggestion.kind,
          alias: aliasNorm,
          tokenStart: start,
          tokenEnd: start + span,
          suggestion,
          aliasLen: aliasNorm.length,
          rank: suggestion.rank,
        });
      }
    }
  }
  for (const sortIntent of SORT_INTENTS) {
    for (const alias of sortIntent.aliases) {
      const aliasNorm = normalizeExploreSearchText(alias);
      if (!aliasNorm) continue;
      for (let start = 0; start < normTokens.length; start++) {
        const span = windowMatchesAlias(normTokens, start, aliasNorm);
        if (!span) continue;
        hits.push({
          id: sortIntent.id,
          kind: 'sort',
          alias: aliasNorm,
          tokenStart: start,
          tokenEnd: start + span,
          sort: sortIntent.sort,
          aliasLen: aliasNorm.length,
          rank: sortIntent.rank,
        });
      }
    }
  }
  hits.sort((a, b) => {
    if (b.aliasLen !== a.aliasLen) return b.aliasLen - a.aliasLen;
    if (b.rank !== a.rank) return b.rank - a.rank;
    if (a.tokenStart !== b.tokenStart) return a.tokenStart - b.tokenStart;
    return a.id.localeCompare(b.id);
  });
  return hits;
}

function overlapsConsumed(hit: AliasHit, consumed: boolean[]): boolean {
  for (let i = hit.tokenStart; i < hit.tokenEnd; i++) {
    if (consumed[i]) return true;
  }
  return false;
}

function markConsumed(hit: AliasHit, consumed: boolean[]) {
  for (let i = hit.tokenStart; i < hit.tokenEnd; i++) consumed[i] = true;
}

function slotKey(hit: AliasHit): string {
  if (hit.kind === 'city') return 'city';
  if (hit.kind === 'property_type') return 'property_type';
  if (hit.kind === 'sort') return 'sort';
  if (hit.suggestion?.params.hasPool) return 'hasPool';
  if (hit.suggestion?.params.amenities?.includes('football')) return 'football';
  if (hit.suggestion?.params.allowsEvents) return 'allowsEvents';
  if (hit.suggestion?.params.allowsOvernight) return 'allowsOvernight';
  return hit.id;
}

/**
 * Strip filler only when orphaned beside a consumed structured token.
 * Preserves ordinary words inside residual property-name phrases.
 */
function buildResidual(tokens: string[], normTokens: string[], consumed: boolean[]): string | undefined {
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const n = normTokens[i]!;
    if (FILLER_TOKENS.has(n)) {
      const leftConsumed = i > 0 && consumed[i - 1] === true;
      const rightConsumed = i < tokens.length - 1 && consumed[i + 1] === true;
      if (leftConsumed || rightConsumed) continue;
    }
    kept.push(tokens[i]!);
  }
  const residualQuery = kept.join(' ').trim() || undefined;
  return residualQuery;
}

/**
 * Deterministic compound free-text → structured Explore filters.
 * No AI. Reuses Phase 2A alias catalog. Safe to call only on submit.
 */
export function parseExploreSearchIntent(
  input: string,
  _context?: { locale?: 'ar' | 'en' },
): ExploreSearchIntentParseResult {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { params: {}, matched: [] };
  }

  const tokens = tokenize(trimmed);
  const normTokens = tokens.map(normalizeExploreSearchText);
  const hits = collectHits(normTokens, listExploreLocalSuggestionCatalog());
  const consumed = new Array(tokens.length).fill(false);
  const matched: ExploreSearchIntentMatch[] = [];
  const takenSlots = new Set<string>();
  let params: Partial<PropertySearchQuery> = {};

  // Pass 1: non-property-type structured intents (city, amenities, sorts, …).
  const sortHitsSeen = new Set<string>();
  for (const hit of hits) {
    if (hit.kind === 'property_type') continue;
    if (hit.kind === 'sort') {
      sortHitsSeen.add(hit.id);
      continue; // resolve sorts after scanning conflicts
    }
    const key = slotKey(hit);
    if (takenSlots.has(key)) continue;
    if (overlapsConsumed(hit, consumed)) continue;
    markConsumed(hit, consumed);
    takenSlots.add(key);
    matched.push({
      id: hit.id,
      kind: hit.kind,
      alias: hit.alias,
      tokenStart: hit.tokenStart,
      tokenEnd: hit.tokenEnd,
    });
    if (hit.suggestion) params = { ...params, ...hit.suggestion.params };
  }

  // Sort: apply only when exactly one distinct sort intent is present (no conflict).
  const distinctSorts = [...sortHitsSeen];
  if (distinctSorts.length === 1) {
    const sortId = distinctSorts[0]!;
    const sortHit = hits.find(
      (h) => h.kind === 'sort' && h.id === sortId && !overlapsConsumed(h, consumed),
    );
    if (sortHit?.sort) {
      markConsumed(sortHit, consumed);
      matched.push({
        id: sortHit.id,
        kind: 'sort',
        alias: sortHit.alias,
        tokenStart: sortHit.tokenStart,
        tokenEnd: sortHit.tokenEnd,
      });
      params = { ...params, sort: sortHit.sort };
    }
  }
  // Conflicting sorts: leave tokens in residual; do not set sort.

  // Pass 2: property types — never silently pick among conflicts.
  const typeCandidates = hits.filter(
    (h) => h.kind === 'property_type' && !overlapsConsumed(h, consumed),
  );
  const distinctTypes = [...new Set(typeCandidates.map((h) => h.id))];
  if (distinctTypes.length === 1) {
    const typeHit = typeCandidates.find((h) => h.id === distinctTypes[0]);
    if (typeHit?.suggestion) {
      markConsumed(typeHit, consumed);
      matched.push({
        id: typeHit.id,
        kind: typeHit.kind,
        alias: typeHit.alias,
        tokenStart: typeHit.tokenStart,
        tokenEnd: typeHit.tokenEnd,
      });
      params = { ...params, ...typeHit.suggestion.params };
    }
  }
  // Conflicting property types: leave all type tokens searchable in residual q.

  const residualQuery = buildResidual(tokens, normTokens, consumed);

  if (!matched.length) {
    // Whole-query unique prefix (e.g. مزر → farm) — keep residual q for search mode.
    const prefix = resolveUniqueExplorePrefixSuggestion(trimmed);
    if (prefix) {
      return {
        params: {
          ...prefix.params,
          q: trimmed,
        },
        residualQuery: trimmed,
        matched: [
          {
            id: prefix.id,
            kind: prefix.kind,
            alias: normalizeExploreSearchText(trimmed),
            tokenStart: 0,
            tokenEnd: tokens.length,
          },
        ],
      };
    }
    return {
      params: { q: trimmed },
      residualQuery: trimmed,
      matched: [],
    };
  }

  return {
    params: {
      ...params,
      ...(residualQuery ? { q: residualQuery } : {}),
    },
    residualQuery,
    matched,
  };
}

/**
 * Merge parsed compound intent onto current Explore browse context.
 * Detected structured fields are applied together (e.g. farm + pool + city).
 * Unmatched residual becomes `q`. Fields not detected keep compatible base values.
 */
export function applyParsedExploreSearchIntent(
  base: Partial<PropertySearchQuery>,
  parsed: ExploreSearchIntentParseResult,
): Partial<PropertySearchQuery> {
  const next: Partial<PropertySearchQuery> = {
    city: base.city,
    area: base.area,
    date: base.date,
    period: base.period,
    guests: base.guests,
    sort: base.sort ?? 'recommended',
    lat: base.lat,
    lng: base.lng,
    propertyType: base.propertyType,
    hasPool: base.hasPool,
    amenities: base.amenities,
    allowsOvernight: base.allowsOvernight,
    allowsEvents: base.allowsEvents,
    featured: base.featured,
    verifiedOnly: base.verifiedOnly,
  };

  if (!parsed.matched.length) {
    next.q = parsed.params.q ?? parsed.residualQuery;
    return next;
  }

  if (parsed.params.city !== undefined) {
    next.city = parsed.params.city;
    next.area = undefined;
  }
  if (parsed.params.propertyType !== undefined) next.propertyType = parsed.params.propertyType;
  if (parsed.params.hasPool !== undefined) next.hasPool = parsed.params.hasPool;
  if (parsed.params.amenities !== undefined) next.amenities = parsed.params.amenities;
  if (parsed.params.allowsEvents !== undefined) next.allowsEvents = parsed.params.allowsEvents;
  if (parsed.params.allowsOvernight !== undefined) next.allowsOvernight = parsed.params.allowsOvernight;
  if (parsed.params.sort !== undefined) next.sort = parsed.params.sort;

  next.q = parsed.residualQuery;
  return next;
}
