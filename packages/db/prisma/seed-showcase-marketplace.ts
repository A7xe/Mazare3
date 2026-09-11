/**
 * MAZARE3_SHOWCASE_2026 — idempotent local/dev marketplace showcase seed.
 * Does NOT wipe the database. Does NOT fabricate reviews/bookings/ratings.
 *
 * Run: pnpm --filter @mazare3/db seed:showcase
 */
import './load-env.js';
import { assertShowcaseEnvAllowed } from './showcase-env-guard.js';
import {
  SHOWCASE_MARKER,
  SHOWCASE_OWNERS,
  SHOWCASE_PASSWORD,
  SHOWCASE_PROPERTIES,
  SHOWCASE_SLUG_PREFIX,
  imagesForProperty,
  showcaseOwnerEmail,
} from './showcase-manifest.js';
import {
  AvailabilityPeriod,
  AvailabilitySlotStatus,
  PlacementType,
  PrismaClient,
  PromotionDiscountType,
  PromotionStatus,
  PropertyStatus,
  VerificationStatus,
} from '../generated/client/index.js';
import bcrypt from 'bcryptjs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

assertShowcaseEnvAllowed('seed-showcase-marketplace');

const prisma = new PrismaClient();

const AMENITIES = [
  { key: 'pool', labelAr: 'مسبح', labelEn: 'Pool' },
  { key: 'heated_pool', labelAr: 'مسبح مدفأ', labelEn: 'Heated pool' },
  { key: 'indoor_pool', labelAr: 'مسبح داخلي', labelEn: 'Indoor pool' },
  { key: 'bbq', labelAr: 'شواء', labelEn: 'BBQ' },
  { key: 'football', labelAr: 'ملعب كرة', labelEn: 'Football field' },
  { key: 'wifi', labelAr: 'واي فاي', labelEn: 'Wi-Fi' },
  { key: 'parking', labelAr: 'موقف سيارات', labelEn: 'Parking' },
  { key: 'ac', labelAr: 'تكييف', labelEn: 'A/C' },
  { key: 'garden', labelAr: 'حديقة', labelEn: 'Garden' },
  { key: 'events', labelAr: 'مناسبات', labelEn: 'Events' },
  { key: 'kids_pool', labelAr: 'مسبح أطفال', labelEn: 'Kids pool' },
] as const;

const SHOWCASE_ADMIN_EMAIL = `showcase.2026.admin@mazare3.local`;

async function ensureAmenities() {
  for (const a of AMENITIES) {
    await prisma.amenity.upsert({
      where: { key: a.key },
      create: a,
      update: { labelAr: a.labelAr, labelEn: a.labelEn, isActive: true },
    });
  }
  return Object.fromEntries((await prisma.amenity.findMany()).map((a) => [a.key, a.id]));
}

async function ensureShowcaseAdmin(passwordHash: string) {
  return prisma.user.upsert({
    where: { email: SHOWCASE_ADMIN_EMAIL },
    create: {
      email: SHOWCASE_ADMIN_EMAIL,
      name: `${SHOWCASE_MARKER} Admin`,
      passwordHash,
      role: 'admin',
      locale: 'ar',
    },
    update: {
      name: `${SHOWCASE_MARKER} Admin`,
      passwordHash,
      role: 'admin',
      status: 'active',
    },
  });
}

async function ensureOwner(passwordHash: string, index: number) {
  const def = SHOWCASE_OWNERS[index]!;
  const user = await prisma.user.upsert({
    where: { email: def.email },
    create: {
      email: def.email,
      name: def.name,
      passwordHash,
      role: 'owner',
      locale: 'ar',
      phone: def.phone,
    },
    update: {
      name: def.name,
      passwordHash,
      role: 'owner',
      status: 'active',
      phone: def.phone,
    },
  });

  const existing = await prisma.ownerProfile.findUnique({ where: { userId: user.id } });
  if (existing) {
    return prisma.ownerProfile.update({
      where: { id: existing.id },
      data: {
        displayName: def.displayName,
        phone: def.phone,
        city: def.city,
        area: def.area,
        status: 'approved',
        rejectionReason: null,
        bio: `${SHOWCASE_MARKER} showcase owner fixture (internal).`,
      },
    });
  }
  return prisma.ownerProfile.create({
    data: {
      userId: user.id,
      displayName: def.displayName,
      phone: def.phone,
      city: def.city,
      area: def.area,
      status: 'approved',
      bio: `${SHOWCASE_MARKER} showcase owner fixture (internal).`,
    },
  });
}

async function replaceMedia(propertyId: string, num: number) {
  await prisma.propertyMedia.deleteMany({ where: { propertyId } });
  const images = imagesForProperty(num);
  for (const [i, img] of images.entries()) {
    await prisma.propertyMedia.create({
      data: {
        propertyId,
        url: img.url,
        altAr: img.altAr,
        altEn: img.altEn,
        sortOrder: i,
        verificationStatus: VerificationStatus.owner_uploaded,
        storageKey: null,
      },
    });
  }
  return images;
}

async function replaceRules(
  propertyId: string,
  rules: { titleAr: string; titleEn: string }[],
) {
  await prisma.propertyRule.deleteMany({ where: { propertyId } });
  for (const [i, rule] of rules.entries()) {
    await prisma.propertyRule.create({
      data: {
        propertyId,
        titleAr: rule.titleAr,
        titleEn: rule.titleEn,
        sortOrder: i,
      },
    });
  }
}

async function replaceAmenities(propertyId: string, keys: string[], amenityMap: Record<string, string>) {
  await prisma.propertyAmenity.deleteMany({ where: { propertyId } });
  for (const key of keys) {
    const amenityId = amenityMap[key];
    if (!amenityId) continue;
    await prisma.propertyAmenity.create({ data: { propertyId, amenityId } });
  }
}

async function replacePlacements(
  propertyId: string,
  adminId: string,
  opts: { featured: boolean; sponsored: boolean },
) {
  await prisma.propertyPlacement.deleteMany({ where: { propertyId } });
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() - 1);
  const endsAt = new Date();
  endsAt.setUTCDate(endsAt.getUTCDate() + 90);

  if (opts.featured) {
    await prisma.propertyPlacement.create({
      data: {
        propertyId,
        placementType: PlacementType.featured,
        startsAt,
        endsAt,
        status: PromotionStatus.active,
        adminNote: SHOWCASE_MARKER,
        createdByAdminId: adminId,
      },
    });
  }
  if (opts.sponsored) {
    await prisma.propertyPlacement.create({
      data: {
        propertyId,
        placementType: PlacementType.sponsored,
        startsAt,
        endsAt,
        status: PromotionStatus.active,
        adminNote: SHOWCASE_MARKER,
        createdByAdminId: adminId,
      },
    });
  }
}

async function replacePromotion(
  propertyId: string,
  discountPercent: number,
  titleAr: string,
  titleEn: string,
) {
  await prisma.propertyPromotion.deleteMany({ where: { propertyId } });
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() - 1);
  const endsAt = new Date();
  endsAt.setUTCDate(endsAt.getUTCDate() + 45);
  await prisma.propertyPromotion.create({
    data: {
      propertyId,
      titleAr,
      titleEn,
      discountType: PromotionDiscountType.percentage,
      discountValue: discountPercent,
      startsAt,
      endsAt,
      period: null,
      status: PromotionStatus.active,
    },
  });
}

async function ensureAvailability(propertyId: string, basePrice: number, allowsOvernight: boolean) {
  const periods: AvailabilityPeriod[] = ['morning', 'evening', 'full_day', 'overnight'];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Replace window for idempotency without thousands of per-row upserts.
  await prisma.availabilitySlot.deleteMany({ where: { propertyId } });
  const rows: {
    propertyId: string;
    date: Date;
    period: AvailabilityPeriod;
    price: number;
    status: AvailabilitySlotStatus;
  }[] = [];
  for (let dayOffset = 1; dayOffset <= 60; dayOffset++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    for (const period of periods) {
      if (period === 'overnight' && !allowsOvernight) continue;
      let status: AvailabilitySlotStatus = AvailabilitySlotStatus.available;
      if (dayOffset % 9 === 0) status = AvailabilitySlotStatus.blocked;
      else if (dayOffset % 11 === 5 && period === 'evening') status = AvailabilitySlotStatus.blocked;

      const multiplier =
        period === 'morning' ? 0.45 : period === 'evening' ? 0.55 : period === 'overnight' ? 1.15 : 1;
      rows.push({
        propertyId,
        date,
        period,
        price: Math.round(basePrice * multiplier),
        status,
      });
    }
  }
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.availabilitySlot.createMany({ data: rows.slice(i, i + chunk) });
  }
}

async function main() {
  console.log(`\n🌱 Seeding ${SHOWCASE_MARKER} (local/dev only)…\n`);
  const passwordHash = await bcrypt.hash(SHOWCASE_PASSWORD, 10);
  const amenityMap = await ensureAmenities();
  const admin = await ensureShowcaseAdmin(passwordHash);

  const owners = [];
  for (let i = 0; i < SHOWCASE_OWNERS.length; i++) {
    owners.push(await ensureOwner(passwordHash, i));
  }

  const imageManifest: {
    marker: string;
    generatedAt: string;
    properties: { slug: string; images: string[] }[];
  } = {
    marker: SHOWCASE_MARKER,
    generatedAt: new Date().toISOString(),
    properties: [],
  };

  for (const p of SHOWCASE_PROPERTIES) {
    const owner = owners[p.ownerIndex]!;
    const createdAt = new Date(Date.now() - (SHOWCASE_PROPERTIES.length - p.num) * 3_600_000);

    const existing = await prisma.property.findUnique({ where: { slug: p.slug } });
    const data = {
      ownerId: owner.id,
      slug: p.slug,
      type: p.type,
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      city: p.city,
      area: p.area,
      approximateAddress: p.approximateAddress,
      exactAddress: p.exactAddress,
      latitudeApprox: p.lat,
      longitudeApprox: p.lng,
      capacity: p.capacity,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      poolsCount: p.poolsCount,
      hasIndoorPool: p.hasIndoorPool,
      hasHeatedPool: p.hasHeatedPool,
      hasFootballField: p.hasFootballField,
      allowsFamilies: p.allowsFamilies,
      allowsYouth: p.allowsYouth,
      allowsOvernight: p.allowsOvernight,
      allowsEvents: p.allowsEvents,
      instantBookingEnabled: p.instantBookingEnabled,
      checkInTime: p.checkInTime,
      checkOutTime: p.checkOutTime,
      status: PropertyStatus.published,
      verificationStatus: VerificationStatus.platform_reviewed,
      hasPlatformDeal: false,
      // Truthful: no fabricated social proof
      ratingAvg: null,
      reviewCount: 0,
      basePrice: p.basePrice,
      currency: 'JOD',
    };

    const property = existing
      ? await prisma.property.update({ where: { id: existing.id }, data })
      : await prisma.property.create({ data });

    // Keep Recently Added eligibility (createdAt within 7 days) on re-seed.
    await prisma.$executeRaw`
      UPDATE "Property" SET "createdAt" = ${createdAt} WHERE id = ${property.id}
    `;

    const images = await replaceMedia(property.id, p.num);
    await replaceRules(property.id, p.rules);
    await replaceAmenities(property.id, p.amenityKeys, amenityMap);
    await replacePlacements(property.id, admin.id, {
      featured: p.featured,
      sponsored: p.sponsored,
    });
    if (p.offer) {
      await replacePromotion(
        property.id,
        p.offerDiscountPercent ?? 10,
        'عرض خاص لفترة محدودة',
        'Limited-time offer',
      );
    } else {
      await prisma.propertyPromotion.deleteMany({ where: { propertyId: property.id } });
    }
    await ensureAvailability(property.id, p.basePrice, p.allowsOvernight);

    imageManifest.properties.push({
      slug: p.slug,
      images: images.map((i) => i.url),
    });

    console.log(`  ✓ ${p.slug} — ${p.titleAr}`);
  }

  // Remove orphan showcase properties no longer in manifest (slug prefix only).
  const keepSlugs = SHOWCASE_PROPERTIES.map((p) => p.slug);
  const orphans = await prisma.property.findMany({
    where: {
      slug: { startsWith: SHOWCASE_SLUG_PREFIX },
      NOT: { slug: { in: keepSlugs } },
    },
    select: { id: true, slug: true },
  });
  for (const o of orphans) {
    await prisma.property.delete({ where: { id: o.id } });
    console.log(`  🗑 removed orphan ${o.slug}`);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = join(here, 'showcase-image-sources.local.json');
  writeFileSync(manifestPath, JSON.stringify(imageManifest, null, 2), 'utf8');

  const count = await prisma.property.count({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
  });
  const mediaCount = await prisma.propertyMedia.count({
    where: { property: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } } },
  });
  const featured = await prisma.propertyPlacement.count({
    where: {
      placementType: PlacementType.featured,
      status: PromotionStatus.active,
      adminNote: SHOWCASE_MARKER,
    },
  });
  const sponsored = await prisma.propertyPlacement.count({
    where: {
      placementType: PlacementType.sponsored,
      status: PromotionStatus.active,
      adminNote: SHOWCASE_MARKER,
    },
  });
  const offers = await prisma.propertyPromotion.count({
    where: {
      status: PromotionStatus.active,
      property: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
    },
  });

  console.log(`\n✅ ${SHOWCASE_MARKER}`);
  console.log(`   properties: ${count} (expected 12)`);
  console.log(`   media rows: ${mediaCount} (expected 120)`);
  console.log(`   featured placements: ${featured}`);
  console.log(`   sponsored placements: ${sponsored}`);
  console.log(`   active promotions: ${offers}`);
  console.log(`   owners: ${SHOWCASE_OWNERS.map((_, i) => showcaseOwnerEmail(i)).join(', ')}`);
  console.log(`   image source manifest: ${manifestPath}`);
  console.log(`   (password omitted — internal fixture only)\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
