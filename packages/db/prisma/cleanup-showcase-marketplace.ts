/**
 * MAZARE3_SHOWCASE_2026 — scoped cleanup (local/dev only).
 * Removes ONLY showcase fixture records (slug/email markers). Never broad-deletes.
 *
 * Run: pnpm --filter @mazare3/db cleanup:showcase
 */
import './load-env.js';
import { assertShowcaseEnvAllowed } from './showcase-env-guard.js';
import {
  SHOWCASE_EMAIL_DOMAIN,
  SHOWCASE_EMAIL_PREFIX,
  SHOWCASE_MARKER,
  SHOWCASE_SLUG_PREFIX,
} from './showcase-manifest.js';
import { PrismaClient } from '../generated/client/index.js';

assertShowcaseEnvAllowed('cleanup-showcase-marketplace');

const prisma = new PrismaClient();

const SHOWCASE_ADMIN_EMAIL = `showcase.2026.admin@mazare3.local`;

async function main() {
  console.log(`\n🧹 Cleaning ${SHOWCASE_MARKER} (local/dev only)…\n`);

  const properties = await prisma.property.findMany({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
    select: { id: true, slug: true },
  });
  const propertyIds = properties.map((p) => p.id);

  if (propertyIds.length) {
    // Child rows mostly cascade; delete explicitly for clarity / sponsorship links.
    await prisma.sponsoredPlacementOrder.deleteMany({
      where: { propertyId: { in: propertyIds } },
    });
    await prisma.propertyPlacement.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.propertyPromotion.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.propertyCoupon.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.availabilitySlot.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.propertyAvailabilityRule.deleteMany({
      where: { propertyId: { in: propertyIds } },
    });
    await prisma.propertyMedia.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.propertyRule.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.propertyAmenity.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await prisma.favorite.deleteMany({ where: { propertyId: { in: propertyIds } } });
    // Bookings/reviews should not exist for showcase; refuse if any found.
    const bookingCount = await prisma.booking.count({
      where: { propertyId: { in: propertyIds } },
    });
    const reviewCount = await prisma.review.count({
      where: { propertyId: { in: propertyIds } },
    });
    if (bookingCount > 0 || reviewCount > 0) {
      console.error(
        `❌ Showcase properties have unexpected bookings (${bookingCount}) or reviews (${reviewCount}). Aborting cleanup.`,
      );
      process.exit(1);
    }
    await prisma.property.deleteMany({ where: { id: { in: propertyIds } } });
    console.log(`  ✓ deleted ${properties.length} properties`);
  } else {
    console.log('  · no showcase properties found');
  }

  const ownerUsers = await prisma.user.findMany({
    where: {
      email: { startsWith: SHOWCASE_EMAIL_PREFIX, endsWith: `@${SHOWCASE_EMAIL_DOMAIN}` },
      role: 'owner',
    },
    select: { id: true, email: true },
  });
  for (const u of ownerUsers) {
    const profile = await prisma.ownerProfile.findUnique({ where: { userId: u.id } });
    if (profile) {
      const remaining = await prisma.property.count({ where: { ownerId: profile.id } });
      if (remaining > 0) {
        console.error(`❌ Owner ${u.email} still has ${remaining} non-showcase properties. Abort.`);
        process.exit(1);
      }
      await prisma.ownerDocument.deleteMany({ where: { ownerId: profile.id } });
      await prisma.ownerOnboardingChangeRequest.deleteMany({ where: { ownerId: profile.id } });
      await prisma.partnerAgreementAcceptance.deleteMany({ where: { ownerId: profile.id } });
      await prisma.partnerCommercialTerms.deleteMany({ where: { ownerId: profile.id } });
      await prisma.ownerPayoutProfile.deleteMany({ where: { ownerId: profile.id } });
      await prisma.ownerVerificationProfile.deleteMany({ where: { ownerId: profile.id } });
      await prisma.sponsoredPlacementOrder.deleteMany({ where: { ownerId: profile.id } });
      await prisma.ownerProfile.delete({ where: { id: profile.id } });
    }
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`  ✓ deleted owner ${u.email}`);
  }

  const admin = await prisma.user.findUnique({ where: { email: SHOWCASE_ADMIN_EMAIL } });
  if (admin) {
    const placementsLeft = await prisma.propertyPlacement.count({
      where: { createdByAdminId: admin.id },
    });
    if (placementsLeft > 0) {
      console.error(
        `❌ Showcase admin still referenced by ${placementsLeft} placements. Abort.`,
      );
      process.exit(1);
    }
    await prisma.user.delete({ where: { id: admin.id } });
    console.log(`  ✓ deleted ${SHOWCASE_ADMIN_EMAIL}`);
  }

  const leftoverProps = await prisma.property.count({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
  });
  const leftoverUsers = await prisma.user.count({
    where: { email: { startsWith: SHOWCASE_EMAIL_PREFIX } },
  });
  if (leftoverProps || leftoverUsers) {
    console.error(`❌ Cleanup incomplete: props=${leftoverProps} users=${leftoverUsers}`);
    process.exit(1);
  }

  console.log(`\n✅ ${SHOWCASE_MARKER} removed. Non-showcase data untouched.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
