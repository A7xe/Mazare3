/**
 * One-off local helper: assign random display ratings to published properties
 * that still have reviewCount = 0 (so homepage cards are not empty stars).
 *
 * Live published Review rows still win via applyLiveRating.
 */
import { prisma } from '@mazare3/db';

function randomRating(): number {
  // 4.2 – 5.0 in 0.1 steps (premium marketplace look)
  const tenths = 42 + Math.floor(Math.random() * 9);
  return tenths / 10;
}

function randomReviewCount(): number {
  return 8 + Math.floor(Math.random() * 48); // 8–55
}

async function main() {
  const properties = await prisma.property.findMany({
    where: {
      status: 'published',
      reviewCount: 0,
    },
    select: { id: true, titleAr: true, slug: true },
  });

  if (!properties.length) {
    console.log('No published properties with reviewCount=0. Nothing to update.');
    return;
  }

  let updated = 0;
  for (const property of properties) {
    const ratingAvg = randomRating();
    const reviewCount = randomReviewCount();
    await prisma.property.update({
      where: { id: property.id },
      data: { ratingAvg, reviewCount },
    });
    updated += 1;
    console.log(`✓ ${property.slug}: ${ratingAvg} (${reviewCount})`);
  }

  console.log(`\nUpdated ${updated} propert${updated === 1 ? 'y' : 'ies'}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
