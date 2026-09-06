/**
 * LOCAL-ONLY audit / cleanup of proven automated QA/E2E marketplace fixtures.
 *
 * Default: DRY RUN (read-only).
 *
 * Usage:
 *   node scripts/audit-local-qa-fixtures.mjs
 *   node scripts/audit-local-qa-fixtures.mjs --apply
 *
 * --apply unpublishes ONLY strong-pattern fixtures and pauses their placements/promotions.
 * Ambiguous QA/E2E-looking titles are never mutated.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnv();

const APPLY = process.argv.includes('--apply');

/** Title prefixes used by known automated suites (stronger than bare "QA" / "E2E"). */
export const STRONG_FAMILIES = [
  {
    id: 'e2e_homepage',
    label: 'E2E homepage merchandising',
    titlePrefixes: ['E2E Home S ', 'E2E Home F ', 'E2E Home O ', 'E2E Home R ', 'E2E Home N '],
  },
  {
    id: 'e2e_placements',
    label: 'E2E placements',
    titlePrefixes: ['E2E Spon ', 'E2E Feat ', 'E2E Org '],
  },
  {
    id: 'e2e_sponsorship',
    label: 'E2E paid sponsorship',
    titlePrefixes: ['E2E Paid '],
  },
  {
    id: 'e2e_discovery',
    label: 'E2E discovery / desk',
    titlePrefixes: ['E2E Disc ', 'E2E Desk '],
  },
  {
    id: 'e2e_merch1',
    label: 'E2E MERCH-1 / MERCH-2',
    titlePrefixes: ['E2E Merch1 ', 'E2E Merch2 '],
  },
  {
    id: 'qa_homepage_api',
    label: 'QA homepage discovery API',
    titlePrefixes: [
      'QA Home S ',
      'QA Home F ',
      'QA Home O ',
      'QA Home R ',
      'QA Home N ',
      'QA Home U ',
      'QA Home E ',
    ],
  },
  {
    id: 'qa_placement_scripts',
    label: 'QA placement / future / exp scripts',
    titlePrefixes: [
      'QA Spon ',
      'QA Feat ',
      'QA Future ',
      'QA Exp ',
      'QA Unpub ',
      'QA Draft ',
    ],
  },
];

export function matchStrongFamily(titleEn) {
  const t = titleEn ?? '';
  for (const fam of STRONG_FAMILIES) {
    if (fam.titlePrefixes.some((prefix) => t.startsWith(prefix))) return fam.id;
  }
  return null;
}

export function isAmbiguousQaE2eTitle(titleEn, strongFamilyId) {
  if (strongFamilyId) return false;
  const t = titleEn ?? '';
  return t.startsWith('QA ') || t.startsWith('E2E ');
}

/**
 * Strict gate for mutations. Read-only dry-run uses the same gate for APP_ENV/NODE_ENV
 * but is slightly more permissive on remote DB warnings.
 */
export function assertLocalSafeForMutation() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

  if (nodeEnv === 'production') {
    throw new Error('LOCAL CLEANUP SAFETY REFUSED: NODE_ENV=production');
  }
  if (!appEnv) {
    throw new Error('LOCAL CLEANUP SAFETY REFUSED: APP_ENV is unset (must be local or test)');
  }
  if (appEnv === 'production' || appEnv === 'staging') {
    throw new Error(`LOCAL CLEANUP SAFETY REFUSED: APP_ENV=${appEnv}`);
  }
  if (appEnv !== 'local' && appEnv !== 'test') {
    throw new Error(
      `LOCAL CLEANUP SAFETY REFUSED: APP_ENV=${appEnv} (mutations require local|test)`,
    );
  }

  const db = process.env.DATABASE_URL ?? '';
  if (!db) {
    throw new Error('LOCAL CLEANUP SAFETY REFUSED: DATABASE_URL missing');
  }
  const lower = db.toLowerCase();
  if (lower.includes('prod') || lower.includes('production') || lower.includes('staging')) {
    // Allow only if clearly a local/dev neon branch style — still refuse bare "prod".
    if (!/localhost|127\.0\.0\.1/.test(lower)) {
      throw new Error(
        'LOCAL CLEANUP SAFETY REFUSED: DATABASE_URL appears production/staging-like',
      );
    }
  }
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    /mazare3\.(com|jo)$/i.test(process.env.NEXT_PUBLIC_APP_URL) &&
    !/localhost|127\.0\.0\.1|trycloudflare/i.test(process.env.NEXT_PUBLIC_APP_URL)
  ) {
    throw new Error('LOCAL CLEANUP SAFETY REFUSED: NEXT_PUBLIC_APP_URL looks like production');
  }

  return { appEnv, nodeEnv };
}

function assertLocalSafeForDryRun() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error('REFUSED: NODE_ENV=production');
  }
  if (appEnv === 'production' || appEnv === 'staging') {
    throw new Error(`REFUSED: APP_ENV=${appEnv || '(empty)'}`);
  }
  if (appEnv && appEnv !== 'local' && appEnv !== 'test' && appEnv !== 'development') {
    throw new Error(`REFUSED: unrecognized APP_ENV=${appEnv}`);
  }
}

async function collectSnapshot(prisma, PropertyStatus, PromotionStatus, PlacementType) {
  const now = new Date();
  const published = await prisma.property.findMany({
    where: { status: PropertyStatus.published, owner: { status: 'approved' } },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      createdAt: true,
      ratingAvg: true,
      reviewCount: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const matchedIds = new Set();
  const byFamily = {};
  for (const fam of STRONG_FAMILIES) {
    const rows = published.filter((p) => matchStrongFamily(p.titleEn) === fam.id);
    for (const r of rows) matchedIds.add(r.id);
    byFamily[fam.id] = {
      label: fam.label,
      publishedCount: rows.length,
      sampleTitles: rows.slice(0, 5).map((r) => r.titleEn),
      ids: rows.map((r) => r.id),
    };
  }

  const ambiguous = published.filter((p) =>
    isAmbiguousQaE2eTitle(p.titleEn, matchStrongFamily(p.titleEn)),
  );
  const nonQa = published.filter(
    (p) => !matchStrongFamily(p.titleEn) && !isAmbiguousQaE2eTitle(p.titleEn, null),
  );

  const liveSponsored = await prisma.propertyPlacement.count({
    where: {
      placementType: PlacementType.sponsored,
      status: PromotionStatus.active,
      startsAt: { lte: now },
      endsAt: { gte: now },
      property: { status: 'published', owner: { status: 'approved' } },
    },
  });
  const liveFeatured = await prisma.propertyPlacement.count({
    where: {
      placementType: PlacementType.featured,
      status: PromotionStatus.active,
      startsAt: { lte: now },
      endsAt: { gte: now },
      property: { status: 'published', owner: { status: 'approved' } },
    },
  });
  const livePromos = await prisma.propertyPromotion.count({
    where: {
      status: PromotionStatus.active,
      startsAt: { lte: now },
      endsAt: { gte: now },
      property: { status: 'published', owner: { status: 'approved' } },
    },
  });

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentlyAdded = published.filter((p) => p.createdAt >= cutoff);
  const topRatedEligible = published
    .filter((p) => (p.reviewCount ?? 0) > 0)
    .sort((a, b) => Number(b.ratingAvg) - Number(a.ratingAvg) || b.reviewCount - a.reviewCount)
    .slice(0, 8);

  return {
    publishedApprovedTotal: published.length,
    strongPatternFixturesPublished: matchedIds.size,
    strongIds: [...matchedIds],
    ambiguousOtherQaE2ePublished: ambiguous.length,
    ambiguousSamples: ambiguous.slice(0, 20).map((p) => ({
      titleEn: p.titleEn,
      createdAt: p.createdAt,
      slug: p.slug,
    })),
    nonQaDemoPublished: nonQa.length,
    nonQaSamples: nonQa.slice(0, 12).map((p) => p.titleEn),
    liveSponsoredPlacements: liveSponsored,
    liveFeaturedPlacements: liveFeatured,
    livePromotions: livePromos,
    recentlyAddedEligible: recentlyAdded.length,
    recentlyAddedSamples: recentlyAdded.slice(0, 5).map((p) => p.titleEn),
    topRatedEligibleCount: published.filter((p) => (p.reviewCount ?? 0) > 0).length,
    topRatedSampleTitles: topRatedEligible.map((p) => p.titleEn),
    topRatedQaDominated: topRatedEligible.every(
      (p) => matchStrongFamily(p.titleEn) || isAmbiguousQaE2eTitle(p.titleEn, null),
    ),
    families: Object.fromEntries(
      Object.entries(byFamily).map(([id, v]) => [
        id,
        { label: v.label, publishedCount: v.publishedCount, sampleTitles: v.sampleTitles },
      ]),
    ),
  };
}

async function applyStrongCleanup(prisma, PropertyStatus, PromotionStatus, strongIds) {
  const now = new Date();
  let unpublished = 0;
  let placementsPaused = 0;
  let promotionsPaused = 0;

  for (const id of strongIds) {
    const pausedPlacements = await prisma.propertyPlacement.updateMany({
      where: {
        propertyId: id,
        status: PromotionStatus.active,
      },
      data: { status: PromotionStatus.paused, updatedAt: now },
    });
    placementsPaused += pausedPlacements.count;

    const pausedPromos = await prisma.propertyPromotion.updateMany({
      where: {
        propertyId: id,
        status: PromotionStatus.active,
      },
      data: { status: PromotionStatus.paused, updatedAt: now },
    });
    promotionsPaused += pausedPromos.count;

    const result = await prisma.property.updateMany({
      where: { id, status: PropertyStatus.published },
      data: { status: PropertyStatus.unpublished, updatedAt: now },
    });
    unpublished += result.count;
  }

  return { unpublished, placementsPaused, promotionsPaused };
}

async function main() {
  if (APPLY) {
    assertLocalSafeForMutation();
  } else {
    assertLocalSafeForDryRun();
  }

  const {
    PrismaClient,
    PropertyStatus,
    PromotionStatus,
    PlacementType,
  } = await import('../packages/db/generated/client/index.js');
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    const before = await collectSnapshot(prisma, PropertyStatus, PromotionStatus, PlacementType);

    if (!APPLY) {
      console.log(
        JSON.stringify(
          {
            mode: 'DRY_RUN',
            appEnv: process.env.APP_ENV ?? null,
            nodeEnv: process.env.NODE_ENV ?? null,
            ...before,
            wouldUnpublishIfApplyApproved: before.strongPatternFixturesPublished,
            note: 'Ambiguous rows are reported but would NOT be auto-cleaned. No mutations performed.',
          },
          null,
          2,
        ),
      );
      return;
    }

    const mutation = await applyStrongCleanup(
      prisma,
      PropertyStatus,
      PromotionStatus,
      before.strongIds,
    );
    const after = await collectSnapshot(prisma, PropertyStatus, PromotionStatus, PlacementType);

    console.log(
      JSON.stringify(
        {
          mode: 'APPLY',
          appEnv: process.env.APP_ENV ?? null,
          nodeEnv: process.env.NODE_ENV ?? null,
          safety: 'PASSED',
          before: {
            publishedApprovedTotal: before.publishedApprovedTotal,
            strongPatternFixturesPublished: before.strongPatternFixturesPublished,
            ambiguousOtherQaE2ePublished: before.ambiguousOtherQaE2ePublished,
            nonQaDemoPublished: before.nonQaDemoPublished,
            liveSponsoredPlacements: before.liveSponsoredPlacements,
            liveFeaturedPlacements: before.liveFeaturedPlacements,
            livePromotions: before.livePromotions,
            recentlyAddedEligible: before.recentlyAddedEligible,
            topRatedSampleTitles: before.topRatedSampleTitles,
          },
          mutation,
          after: {
            publishedApprovedTotal: after.publishedApprovedTotal,
            strongPatternFixturesPublished: after.strongPatternFixturesPublished,
            ambiguousOtherQaE2ePublished: after.ambiguousOtherQaE2ePublished,
            nonQaDemoPublished: after.nonQaDemoPublished,
            liveSponsoredPlacements: after.liveSponsoredPlacements,
            liveFeaturedPlacements: after.liveFeaturedPlacements,
            livePromotions: after.livePromotions,
            recentlyAddedEligible: after.recentlyAddedEligible,
            topRatedSampleTitles: after.topRatedSampleTitles,
            topRatedQaDominated: after.topRatedQaDominated,
            ambiguousSamples: after.ambiguousSamples,
            nonQaSamples: after.nonQaSamples,
            families: after.families,
          },
          note: 'Only strong-pattern fixtures were unpublished. Ambiguous titles untouched.',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
