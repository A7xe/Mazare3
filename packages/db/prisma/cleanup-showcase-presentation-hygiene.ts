/**
 * DEMO-2 — narrowly scoped LOCAL/DEV cleanup of proven seed + QA/E2E public inventory.
 * NEVER touches MAZARE3_SHOWCASE_2026 (sc26-* / showcase.2026.*).
 *
 * Run: pnpm --filter @mazare3/db cleanup:presentation-hygiene
 */
import './load-env.js';
import { assertShowcaseEnvAllowed } from './showcase-env-guard.js';
import { SHOWCASE_SLUG_PREFIX } from './showcase-manifest.js';
import { PrismaClient, PropertyStatus, ReviewStatus } from '../generated/client/index.js';

assertShowcaseEnvAllowed('cleanup-showcase-presentation-hygiene');

const prisma = new PrismaClient();

/** Exact seed PROPERTY slugs from packages/db/prisma/seed.ts (class C). */
const SEED_PROPERTY_SLUGS = [
  'chalet-emerald-dead-sea',
  'villa-naour-amman',
  'istiraha-jerash-olive',
  'farm-salt-events',
  'chalet-madaba-mosaic',
  'pool-house-irbid-premium',
  'villa-ajloun-forest',
  'private-resort-madaba-hills',
  'chalet-salt-panorama',
  'farm-zarqa-outskirts',
] as const;

/** Proven fixture owner emails from seed.ts / E2E helpers (never delete users — unpublish only). */
const SEED_OWNER_EMAILS = [
  'owner1@mazare3.jo',
  'owner2@mazare3.jo',
  'owner3@mazare3.jo',
] as const;

const SEED_CUSTOMER_EMAIL = 'customer@mazare3.jo';

function isShowcaseSlug(slug: string): boolean {
  return slug.startsWith(SHOWCASE_SLUG_PREFIX);
}

function isProvenQaE2eSlug(slug: string): boolean {
  return (
    /^qa-/i.test(slug) ||
    /^e2e-/i.test(slug) ||
    /^notifications-qa-/i.test(slug)
  );
}

async function main() {
  console.log('\n🧹 DEMO-2 presentation hygiene cleanup (local/dev)…\n');

  const candidates = await prisma.property.findMany({
    where: {
      OR: [
        { slug: { in: [...SEED_PROPERTY_SLUGS] } },
        { slug: { startsWith: 'qa-' } },
        { slug: { startsWith: 'e2e-' } },
        {
          owner: {
            user: { email: { in: [...SEED_OWNER_EMAILS] } },
          },
          slug: { not: { startsWith: SHOWCASE_SLUG_PREFIX } },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      status: true,
      titleEn: true,
      owner: { select: { user: { select: { email: true } } } },
    },
  });

  const toUnpublish: typeof candidates = [];
  const skipped: string[] = [];

  for (const row of candidates) {
    if (isShowcaseSlug(row.slug)) {
      skipped.push(`SHOWCASE skip ${row.slug}`);
      continue;
    }
    const email = row.owner.user.email ?? '';
    const seedExact = SEED_PROPERTY_SLUGS.includes(
      row.slug as (typeof SEED_PROPERTY_SLUGS)[number],
    );
    const qaExact = isProvenQaE2eSlug(row.slug) || /\b(QA|E2E)\b/i.test(row.titleEn ?? '');

    if (seedExact || qaExact) {
      toUnpublish.push(row);
    } else {
      skipped.push(`ambiguous leave ${row.slug} (${email})`);
    }
  }

  // Also catch seed slugs that might not have matched OR above if owner changed
  const missingSeed = await prisma.property.findMany({
    where: {
      slug: { in: [...SEED_PROPERTY_SLUGS] },
      status: { not: PropertyStatus.unpublished },
    },
    select: {
      id: true,
      slug: true,
      status: true,
      titleEn: true,
      owner: { select: { user: { select: { email: true } } } },
    },
  });
  for (const row of missingSeed) {
    if (!toUnpublish.some((t) => t.id === row.id) && !isShowcaseSlug(row.slug)) {
      toUnpublish.push(row);
    }
  }

  let unpublished = 0;
  for (const row of toUnpublish) {
    if (row.status === PropertyStatus.unpublished) continue;
    await prisma.property.update({
      where: { id: row.id },
      data: { status: PropertyStatus.unpublished },
    });
    unpublished++;
    console.log(`  ✓ unpublished ${row.slug}`);
  }

  // Unpublish proven seed-customer reviews (Top Rated source) — never sc26.
  const seedCustomer = await prisma.user.findUnique({
    where: { email: SEED_CUSTOMER_EMAIL },
    select: { id: true },
  });
  let reviewsUnpublished = 0;
  if (seedCustomer) {
    const reviews = await prisma.review.findMany({
      where: {
        customerId: seedCustomer.id,
        status: ReviewStatus.published,
        property: { slug: { not: { startsWith: SHOWCASE_SLUG_PREFIX } } },
      },
      select: { id: true, property: { select: { slug: true } } },
    });
    for (const r of reviews) {
      await prisma.review.update({
        where: { id: r.id },
        data: { status: ReviewStatus.hidden },
      });
      reviewsUnpublished++;
      console.log(`  ✓ hid review on ${r.property.slug}`);
    }
  }

  // Pause active placements/promotions on unpublished proven fixtures (keep rows).
  const unpublishedIds = toUnpublish.map((r) => r.id);
  if (unpublishedIds.length) {
    const pl = await prisma.propertyPlacement.updateMany({
      where: {
        propertyId: { in: unpublishedIds },
        status: 'active',
        property: { slug: { not: { startsWith: SHOWCASE_SLUG_PREFIX } } },
      },
      data: { status: 'paused' },
    });
    const pr = await prisma.propertyPromotion.updateMany({
      where: {
        propertyId: { in: unpublishedIds },
        status: 'active',
        property: { slug: { not: { startsWith: SHOWCASE_SLUG_PREFIX } } },
      },
      data: { status: 'paused' },
    });
    console.log(`  · paused placements=${pl.count} promotions=${pr.count}`);
  }

  const sc26 = await prisma.property.count({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX }, status: PropertyStatus.published },
  });
  const publicNonSc26 = await prisma.property.count({
    where: {
      status: PropertyStatus.published,
      slug: { not: { startsWith: SHOWCASE_SLUG_PREFIX } },
      owner: { status: 'approved' },
      city: { not: null },
      area: { not: null },
      approximateAddress: { not: null },
      basePrice: { not: null },
    },
  });

  console.log(`\n✅ Hygiene cleanup`);
  console.log(`   unpublished this run: ${unpublished}`);
  console.log(`   reviews hidden: ${reviewsUnpublished}`);
  console.log(`   showcase published: ${sc26} (expected 12)`);
  console.log(`   remaining public non-showcase eligible: ${publicNonSc26}`);
  if (skipped.length) {
    console.log(`   skipped/ambiguous: ${skipped.length}`);
    for (const s of skipped.slice(0, 20)) console.log(`     - ${s}`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
