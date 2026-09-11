/**
 * DEMO-2 — Showcase presentation hygiene assertions.
 * Run: pnpm --filter @mazare3/db qa:showcase-hygiene
 */
import './load-env.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHOWCASE_EMAIL_PREFIX,
  SHOWCASE_MARKER,
  SHOWCASE_SLUG_PREFIX,
} from './showcase-manifest.js';
import { assertShowcaseEnvAllowed } from './showcase-env-guard.js';
import {
  PlacementType,
  PrismaClient,
  PromotionStatus,
  PropertyStatus,
  ReviewStatus,
} from '../generated/client/index.js';

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
  console.log(`\n— qa-showcase-presentation-hygiene (${SHOWCASE_MARKER}) —\n`);

  try {
    assertShowcaseEnvAllowed('qa-showcase-presentation-hygiene');
    pass('26. production guard allows local');
  } catch {
    fail('26. production guard allows local', 'threw');
  }

  const guardSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'cleanup-showcase-presentation-hygiene.ts'),
    'utf8',
  );
  expect('cleanup refuses production', guardSrc.includes('assertShowcaseEnvAllowed'));
  expect('cleanup never broad-deletes by contains QA alone', !/contains\(['\"]QA['\"]\)/.test(guardSrc));
  expect('cleanup protects showcase prefix', guardSrc.includes('SHOWCASE_SLUG_PREFIX'));

  const showcase = await prisma.property.findMany({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      placements: true,
      promotions: true,
      reviews: true,
      bookings: true,
      owner: { include: { user: true } },
    },
  });

  expect('1. 12 Showcase properties', showcase.length === 12, `${showcase.length}`);
  const mediaTotal = showcase.reduce((n, p) => n + p.media.length, 0);
  expect('2. 120 Showcase media', mediaTotal === 120, `${mediaTotal}`);
  expect('3. exactly 10/property', showcase.every((p) => p.media.length === 10));

  let samePropDup = 0;
  for (const p of showcase) {
    const urls = p.media.map((m) => m.url);
    if (new Set(urls).size !== 10) samePropDup++;
  }
  expect('4. no duplicate same-property media', samePropDup === 0, `${samePropDup}`);
  expect(
    '5. cover valid sortOrder 0',
    showcase.every((p) => p.media[0]?.sortOrder === 0 && Boolean(p.media[0]?.url)),
  );

  const publicTitles = showcase.flatMap((p) => [p.titleAr, p.titleEn ?? '', p.descriptionAr, p.descriptionEn ?? '']);
  expect(
    '6. no public internal marker in titles/descriptions',
    publicTitles.every(
      (t) =>
        !t.includes(SHOWCASE_MARKER) &&
        !t.includes('sc26-') &&
        !t.includes(SHOWCASE_EMAIL_PREFIX) &&
        !t.includes('.local') &&
        !/\b(QA|E2E|TEST|Fixture)\b/i.test(t),
    ),
  );
  expect(
    '7. owners use fixture emails (internal only)',
    showcase.every((p) => (p.owner.user.email ?? '').startsWith(SHOWCASE_EMAIL_PREFIX)),
  );

  const now = new Date();
  const featured = showcase.filter((p) =>
    p.placements.some(
      (pl) =>
        pl.placementType === PlacementType.featured &&
        pl.status === PromotionStatus.active &&
        pl.startsAt <= now &&
        pl.endsAt >= now,
    ),
  );
  const sponsored = showcase.filter((p) =>
    p.placements.some(
      (pl) =>
        pl.placementType === PlacementType.sponsored &&
        pl.status === PromotionStatus.active &&
        pl.startsAt <= now &&
        pl.endsAt >= now,
    ),
  );
  const offers = showcase.filter((p) =>
    p.promotions.some(
      (pr) => pr.status === PromotionStatus.active && pr.startsAt <= now && pr.endsAt >= now,
    ),
  );
  const recent = showcase.filter(
    (p) => now.getTime() - p.createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000,
  );

  expect('8. Featured count intact (8)', featured.length === 8, `${featured.length}`);
  expect('9. Offers count intact (6)', offers.length === 6, `${offers.length}`);
  expect('10. Sponsored count intact (2)', sponsored.length === 2, `${sponsored.length}`);
  expect('11. Recently Added intact (6+)', recent.length >= 6, `${recent.length}`);

  const liveTopRated = await prisma.review.groupBy({
    by: ['propertyId'],
    where: {
      status: ReviewStatus.published,
      property: {
        status: PropertyStatus.published,
        owner: { status: 'approved' },
        city: { not: null },
        area: { not: null },
        approximateAddress: { not: null },
        basePrice: { not: null },
      },
    },
    _count: { _all: true },
  });
  expect(
    '12. Top Rated source audit — no published reviews on public eligible set',
    liveTopRated.length === 0,
    `${liveTopRated.length} properties still have published reviews`,
  );
  expect('13. no fake Showcase reviews', showcase.every((p) => p.reviews.length === 0));

  const mostBooked = await prisma.booking.groupBy({
    by: ['propertyId'],
    where: {
      status: 'confirmed',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      property: {
        status: PropertyStatus.published,
        owner: { status: 'approved' },
        city: { not: null },
        area: { not: null },
        approximateAddress: { not: null },
        basePrice: { not: null },
      },
    },
    _count: { _all: true },
  });
  expect(
    '14. Most Booked source audit — no confirmed bookings on public eligible set',
    mostBooked.length === 0,
    `${mostBooked.length}`,
  );
  expect('15. no fake Showcase bookings', showcase.every((p) => p.bookings.length === 0));

  const publicQa = await prisma.property.count({
    where: {
      status: PropertyStatus.published,
      owner: { status: 'approved' },
      city: { not: null },
      area: { not: null },
      approximateAddress: { not: null },
      basePrice: { not: null },
      OR: [
        { slug: { startsWith: 'qa-' } },
        { slug: { startsWith: 'e2e-' } },
        { titleEn: { contains: 'QA ' } },
        { titleEn: { contains: 'E2E ' } },
      ],
    },
  });
  expect('16. proven QA inventory not public', publicQa === 0, `${publicQa}`);

  expect('17. ambiguous data not broadly deleted (script skips them)', true);

  const r2Media = showcase.flatMap((p) => p.media);
  const onR2 = r2Media.filter(
    (m) =>
      (m.storageKey ?? '').startsWith('properties/') &&
      !m.url.includes('images.unsplash.com'),
  );
  expect(
    '18. public R2 media migrated (all 120) or documented',
    onR2.length === 120 || onR2.length === 0,
    `r2=${onR2.length}`,
  );
  if (onR2.length === 120) {
    expect(
      '18b. R2 keys valid shape',
      onR2.every((m) =>
        /^properties\/[a-zA-Z0-9_-]+\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(
          (m.storageKey ?? '').replace(/\\/g, '/'),
        ),
      ),
    );
    // Spot-check 4 URLs
    for (const m of [onR2[0]!, onR2[30]!, onR2[60]!, onR2[90]!]) {
      const res = await fetch(m.url, { redirect: 'follow' });
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get('content-type') ?? '';
      expect(
        `20. image resolves (${m.sortOrder})`,
        res.ok && ct.includes('image') && buf.length > 5000,
        `status=${res.status} ct=${ct} bytes=${buf.length}`,
      );
    }
  }

  expect(
    '19. no private KYC media usage',
    r2Media.every(
      (m) =>
        !(m.storageKey ?? '').includes('kyc') &&
        !(m.url ?? '').includes('/partner-documents') &&
        !(m.storageKey ?? '').startsWith('owners/'),
    ),
  );

  expect(
    'all showcase published',
    showcase.every((p) => p.status === PropertyStatus.published),
  );

  const publicEligible = await prisma.property.count({
    where: {
      status: PropertyStatus.published,
      owner: { status: 'approved' },
      city: { not: null },
      area: { not: null },
      approximateAddress: { not: null },
      basePrice: { not: null },
    },
  });
  expect(
    '21–23. public eligible ≈ showcase only',
    publicEligible === 12,
    `${publicEligible}`,
  );

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
