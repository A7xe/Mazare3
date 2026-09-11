/**
 * DEMO-1 — Showcase marketplace dataset assertions.
 * Run: pnpm --filter @mazare3/db exec dotenv -e ../../.env -- tsx prisma/qa-showcase-marketplace.ts
 */
import './load-env.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHOWCASE_EMAIL_PREFIX,
  SHOWCASE_MARKER,
  SHOWCASE_OWNERS,
  SHOWCASE_PROPERTIES,
  SHOWCASE_SLUG_PREFIX,
} from './showcase-manifest.js';
import { assertShowcaseEnvAllowed } from './showcase-env-guard.js';
import {
  PlacementType,
  PrismaClient,
  PromotionStatus,
  PropertyStatus,
} from '../generated/client/index.js';

/** Mirrors packages/shared RECENTLY_ADDED_WINDOW_DAYS = 7 */
function isNewlyAddedCreatedAt(isoOrDate: string | Date, now = new Date()): boolean {
  const created = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000;
}

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}

async function main() {
  console.log(`\n— qa-showcase-marketplace (${SHOWCASE_MARKER}) —\n`);

  // Production guard source check
  const guardSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'showcase-env-guard.ts'),
    'utf8',
  );
  expect('production guard checks NODE_ENV', guardSrc.includes("nodeEnv === 'production'"));
  expect('production guard checks APP_ENV', guardSrc.includes("appEnv === 'production'"));
  expect('no production bypass flags', !guardSrc.includes('--force') && !guardSrc.includes('FORCE_PRODUCTION'));

  // Soft-run guard (should not exit — we are local)
  try {
    assertShowcaseEnvAllowed('qa-showcase-marketplace');
    pass('showcase env allowed in current process');
  } catch {
    fail('showcase env allowed in current process', 'threw');
  }

  const props = await prisma.property.findMany({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
    include: {
      owner: { include: { user: true } },
      media: true,
      amenities: true,
      rules: true,
      placements: true,
      promotions: true,
      reviews: true,
      bookings: true,
      _count: { select: { availabilitySlots: true } },
    },
    orderBy: { slug: 'asc' },
  });

  expect('1. 12 showcase properties', props.length === 12, `got ${props.length}`);
  expect(
    '2. deterministic slug marker',
    props.every((p) => p.slug.startsWith(SHOWCASE_SLUG_PREFIX)),
  );
  expect(
    '2b. exactAddress carries internal marker',
    props.every((p) => (p.exactAddress ?? '').includes(SHOWCASE_MARKER)),
  );

  const ownerEmails = new Set(props.map((p) => p.owner.user.email));
  expect('3. owner count 3–5', ownerEmails.size >= 3 && ownerEmails.size <= 5, `${ownerEmails.size}`);
  expect(
    '3b. owners use showcase emails',
    [...ownerEmails].every((e) => (e ?? '').startsWith(SHOWCASE_EMAIL_PREFIX)),
  );
  expect(
    '3c. all owners approved',
    props.every((p) => p.owner.status === 'approved'),
  );
  expect(
    '4. all published',
    props.every((p) => p.status === PropertyStatus.published),
  );
  expect(
    '4b. public eligibility fields',
    props.every(
      (p) =>
        p.city &&
        p.area &&
        p.approximateAddress &&
        p.basePrice != null &&
        p.latitudeApprox != null &&
        p.longitudeApprox != null,
    ),
  );
  expect(
    '5. descriptions filled AR+EN',
    props.every(
      (p) =>
        p.descriptionAr.length > 40 &&
        (p.descriptionEn?.length ?? 0) > 40 &&
        !/الأفضل|الأكثر حجز|رقم 1|مئات|آلاف/i.test(p.descriptionAr),
    ),
  );
  expect(
    '6. valid cities',
    props.every((p) =>
      ['amman', 'salt', 'jerash', 'madaba', 'ajloun', 'dead_sea', 'irbid', 'zarqa'].includes(
        p.city ?? '',
      ),
    ),
  );
  expect(
    '7. coordinates diverse',
    new Set(props.map((p) => `${p.latitudeApprox},${p.longitudeApprox}`)).size === 12,
  );
  expect(
    '8. pricing variety JOD',
    props.every((p) => {
      const n = Number(p.basePrice);
      return n >= 70 && n <= 250;
    }) && new Set(props.map((p) => Number(p.basePrice))).size >= 8,
  );
  expect(
    '9. capacities set',
    props.every((p) => p.capacity >= 8 && p.bedrooms >= 1 && p.bathrooms >= 1),
  );
  expect(
    '10. amenities attached',
    props.every((p) => p.amenities.length >= 4 && p.amenities.length <= 10),
  );
  expect('11. 10 images each', props.every((p) => p.media.length === 10));
  expect(
    '12. cover sortOrder 0',
    props.every((p) => p.media.some((m) => m.sortOrder === 0 && m.url)),
  );

  const now = new Date();
  const featured = props.filter((p) =>
    p.placements.some(
      (pl) =>
        pl.placementType === PlacementType.featured &&
        pl.status === PromotionStatus.active &&
        pl.startsAt <= now &&
        pl.endsAt >= now,
    ),
  );
  const offers = props.filter((p) =>
    p.promotions.some(
      (pr) =>
        pr.status === PromotionStatus.active && pr.startsAt <= now && pr.endsAt >= now,
    ),
  );
  const sponsored = props.filter((p) =>
    p.placements.some(
      (pl) =>
        pl.placementType === PlacementType.sponsored &&
        pl.status === PromotionStatus.active &&
        pl.startsAt <= now &&
        pl.endsAt >= now,
    ),
  );
  const recently = props.filter((p) => isNewlyAddedCreatedAt(p.createdAt.toISOString(), now));

  expect('13. Featured 6–8', featured.length >= 6 && featured.length <= 8, `${featured.length}`);
  expect('14. Offers 4–6', offers.length >= 4 && offers.length <= 6, `${offers.length}`);
  expect('15. Recently Added 6+', recently.length >= 6, `${recently.length}`);
  expect('16. Sponsored 2–3', sponsored.length >= 2 && sponsored.length <= 3, `${sponsored.length}`);
  expect('16b. not all sponsored', sponsored.length < props.length);

  expect('17. no reviews', props.every((p) => p.reviews.length === 0));
  expect('18. reviewCount 0 / ratingAvg null', props.every((p) => p.reviewCount === 0 && p.ratingAvg == null));
  expect('19. no bookings', props.every((p) => p.bookings.length === 0));
  expect(
    '20. no fabricated demand fields',
    props.every((p) => p.hasPlatformDeal === false),
  );
  expect(
    '21. availability usable',
    props.every((p) => p._count.availabilitySlots >= 100),
  );

  const instant = props.filter((p) => p.instantBookingEnabled);
  const approval = props.filter((p) => !p.instantBookingEnabled);
  expect('22. instant/approval mix', instant.length >= 1 && approval.length >= 1);

  // Public titles must not look like QA fixtures
  expect(
    '30. no QA/TEST/DEMO in public titles',
    props.every(
      (p) =>
        !/\b(QA|TEST|DEMO|E2E|Fixture)\b/i.test(p.titleAr) &&
        !/\b(QA|TEST|DEMO|E2E|Fixture)\b/i.test(p.titleEn ?? ''),
    ),
  );

  // Manifest vs DB merchandising flags
  for (const def of SHOWCASE_PROPERTIES) {
    const row = props.find((p) => p.slug === def.slug);
    expect(`property ${def.num} exists`, Boolean(row));
    if (!row) continue;
    const isFeat = featured.some((p) => p.id === row.id);
    const isOffer = offers.some((p) => p.id === row.id);
    const isSpon = sponsored.some((p) => p.id === row.id);
    expect(`${def.slug} featured flag`, isFeat === def.featured);
    expect(`${def.slug} offer flag`, isOffer === def.offer);
    expect(`${def.slug} sponsored flag`, isSpon === def.sponsored);
  }

  // Cleanup script is scoped
  const cleanupSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'cleanup-showcase-marketplace.ts'),
    'utf8',
  );
  expect('28. cleanup uses slug prefix', cleanupSrc.includes('SHOWCASE_SLUG_PREFIX'));
  expect('28b. cleanup uses email prefix', cleanupSrc.includes('SHOWCASE_EMAIL_PREFIX'));
  expect('28c. cleanup calls production guard', cleanupSrc.includes('assertShowcaseEnvAllowed'));
  expect('29. seed calls production guard', readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'seed-showcase-marketplace.ts'),
    'utf8',
  ).includes('assertShowcaseEnvAllowed'));

  // Owners fixture count
  expect('owners fixture length', SHOWCASE_OWNERS.length === 4);

  // Idempotency snapshot: counts stable
  const media = await prisma.propertyMedia.count({
    where: { property: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } } },
  });
  const placements = await prisma.propertyPlacement.count({
    where: { property: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } } },
  });
  const promos = await prisma.propertyPromotion.count({
    where: { property: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } } },
  });
  expect('27a. media=120', media === 120, `${media}`);
  expect(
    '27b. placements = featured+sponsored',
    placements === featured.length + sponsored.length,
    `${placements}`,
  );
  expect('27c. promotions = offers', promos === offers.length, `${promos}`);

  // Home/Explore/Search eligibility (schema-level proxies)
  expect(
    '23–25. marketplace card eligibility',
    props.every(
      (p) =>
        p.status === 'published' &&
        p.owner.status === 'approved' &&
        p.city &&
        p.area &&
        p.approximateAddress &&
        p.basePrice != null &&
        p.media.length > 0,
    ),
  );

  // Nearby support: Amman cluster coords present
  const ammanCluster = props.filter((p) => p.city === 'amman');
  expect('26. Nearby: Amman-area coords present', ammanCluster.length >= 3);

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
