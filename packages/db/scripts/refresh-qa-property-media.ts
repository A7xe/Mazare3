/**
 * Gives every QA/E2E listing a unique-looking cover + varied price so browse/search
 * feels realistic. Seed catalog properties are also refreshed.
 */
import '../prisma/load-env.js';
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

/** Distinct leisure-farm / villa / pool covers — verified HTTP 200 only. */
const FARM_IMAGES = [
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
  'https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=1200&q=80',
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
  'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1200&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
  'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80',
  'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
] as const;

const SEED_OVERRIDES: Record<string, { basePrice: number; imageIndex: number }> = {
  'chalet-emerald-dead-sea': { basePrice: 480, imageIndex: 0 },
  'villa-naour-amman': { basePrice: 620, imageIndex: 1 },
  'istiraha-jerash-olive': { basePrice: 175, imageIndex: 2 },
  'farm-salt-events': { basePrice: 340, imageIndex: 3 },
  'chalet-madaba-mosaic': { basePrice: 255, imageIndex: 4 },
  'pool-house-irbid-premium': { basePrice: 190, imageIndex: 5 },
  'villa-ajloun-forest': { basePrice: 410, imageIndex: 6 },
  'farm-zarqa-outskirts': { basePrice: 285, imageIndex: 7 },
  'private-resort-madaba-hills': { basePrice: 750, imageIndex: 8 },
  'chalet-salt-panorama': { basePrice: 230, imageIndex: 9 },
};

/** Stable hash → spread prices between 140 and 780 JOD in 5-JOD steps. */
function priceFromSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const steps = Math.floor((780 - 140) / 5) + 1;
  return 140 + (h % steps) * 5;
}

function imageIndexFromSlug(slug: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < slug.length; i++) h = (h * 33 + slug.charCodeAt(i)) >>> 0;
  return h % FARM_IMAGES.length;
}

async function main() {
  const properties = await prisma.property.findMany({
    select: {
      id: true,
      slug: true,
      allowsOvernight: true,
      verificationStatus: true,
      media: { select: { id: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  });

  let updated = 0;
  for (const [i, property] of properties.entries()) {
    const override = SEED_OVERRIDES[property.slug];
    const basePrice = override?.basePrice ?? priceFromSlug(property.slug);
    const imgIdx = override?.imageIndex ?? imageIndexFromSlug(property.slug, i + 17);
    const coverUrl = FARM_IMAGES[imgIdx]!;
    const secondUrl = FARM_IMAGES[(imgIdx + 7) % FARM_IMAGES.length]!;

    await prisma.property.update({
      where: { id: property.id },
      data: { basePrice },
    });

    await prisma.propertyMedia.deleteMany({ where: { propertyId: property.id } });
    await prisma.propertyMedia.createMany({
      data: [
        {
          propertyId: property.id,
          url: coverUrl,
          altAr: 'صورة المزرعة',
          altEn: 'Property photo',
          sortOrder: 0,
          verificationStatus: property.verificationStatus,
        },
        {
          propertyId: property.id,
          url: secondUrl,
          altAr: 'صورة إضافية',
          altEn: 'Extra photo',
          sortOrder: 1,
          verificationStatus: property.verificationStatus,
        },
      ],
    });

    const periods = ['morning', 'evening', 'full_day', 'overnight'] as const;
    for (const period of periods) {
      if (period === 'overnight' && !property.allowsOvernight) continue;
      const multiplier =
        period === 'morning' ? 0.45 : period === 'evening' ? 0.55 : period === 'overnight' ? 1.2 : 1;
      await prisma.availabilitySlot.updateMany({
        where: { propertyId: property.id, period, status: 'available' },
        data: { price: Math.round(basePrice * multiplier) },
      });
    }

    updated += 1;
    if (updated % 25 === 0) console.log(`… ${updated}/${properties.length}`);
  }

  console.log(`Done. Refreshed ${updated} properties with varied farm images + prices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
