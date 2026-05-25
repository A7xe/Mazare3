import './load-env.js';
import {
  AvailabilityPeriod,
  AvailabilitySlotStatus,
  PrismaClient,
  PropertyStatus,
  PropertyType,
  VerificationStatus,
} from '../generated/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Mazare3Demo2026!';

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

type PropertySeed = {
  slug: string;
  type: PropertyType;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  city: string;
  area: string;
  approximateAddress: string;
  exactAddress: string;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  poolsCount: number;
  hasIndoorPool: boolean;
  hasHeatedPool: boolean;
  hasFootballField: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  allowsOvernight: boolean;
  basePrice: number;
  verificationStatus: VerificationStatus;
  hasPlatformDeal: boolean;
  ratingAvg: number;
  reviewCount: number;
  checkInTime: string;
  checkOutTime: string;
  amenityKeys: string[];
  images: { url: string; altAr: string; altEn: string }[];
  rules: { titleAr: string; titleEn: string }[];
  ownerIndex: number;
};

const PROPERTIES: PropertySeed[] = [
  {
    slug: 'chalet-emerald-dead-sea',
    type: 'chalet',
    titleAr: 'شاليه إميرالد — إطلالة البحر الميت',
    titleEn: 'Emerald Chalet — Dead Sea View',
    descriptionAr:
      'شاليه خاص بمسبح مدفأ وحديقة واسعة، مثالي للعائلات الباحثة عن الخصوصية قرب البحر الميت.',
    descriptionEn:
      'Private chalet with heated pool and garden, ideal for families near the Dead Sea.',
    city: 'dead_sea',
    area: 'سويمة',
    approximateAddress: 'منطقة البحر الميت — سويمة',
    exactAddress: 'طريق البحر الميت — سويمة (مخفي حتى الحجز)',
    capacity: 18,
    bedrooms: 4,
    bathrooms: 3,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: true,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: false,
    allowsOvernight: true,
    basePrice: 280,
    verificationStatus: 'platform_verified',
    hasPlatformDeal: true,
    ratingAvg: 4.9,
    reviewCount: 47,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    amenityKeys: ['pool', 'heated_pool', 'bbq', 'ac', 'wifi', 'parking'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
        altAr: 'واجهة الشاليه',
        altEn: 'Chalet exterior',
      },
    ],
    rules: [
      { titleAr: 'ممنوع التدخين داخل الشاليه', titleEn: 'No smoking inside' },
      { titleAr: 'الالتزام بعدد الضيوف', titleEn: 'Respect guest limit' },
    ],
    ownerIndex: 0,
  },
  {
    slug: 'villa-naour-amman',
    type: 'villa',
    titleAr: 'فيلا ناعور — مسبح وملعب',
    titleEn: 'Naour Villa — Pool & Football',
    descriptionAr: 'فيلا واسعة للعائلات والشباب مع مسبح خارجي وملعب كرة ومنطقة شواء.',
    descriptionEn: 'Spacious villa with pool, football field, and BBQ area in Naour.',
    city: 'amman',
    area: 'ناعور',
    approximateAddress: 'ناعور — ضواحي عمان',
    exactAddress: 'ناعور — شارع داخلي (مخفي حتى الحجز)',
    capacity: 30,
    bedrooms: 5,
    bathrooms: 4,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: true,
    allowsFamilies: true,
    allowsYouth: true,
    allowsOvernight: true,
    basePrice: 350,
    verificationStatus: 'platform_reviewed',
    hasPlatformDeal: false,
    ratingAvg: 4.7,
    reviewCount: 32,
    checkInTime: '13:00',
    checkOutTime: '11:00',
    amenityKeys: ['pool', 'football', 'bbq', 'wifi', 'parking'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80',
        altAr: 'الفيلا',
        altEn: 'Villa',
      },
    ],
    rules: [
      { titleAr: 'ممنوع الضوضاء بعد منتصف الليل', titleEn: 'No loud noise after midnight' },
    ],
    ownerIndex: 0,
  },
  {
    slug: 'istiraha-jerash-olive',
    type: 'istiraha',
    titleAr: 'استراحة جرش — حديقة وزيتون',
    titleEn: 'Jerash Istiraha — Olive Garden',
    descriptionAr: 'استراحة هادئة محاطة بأشجار الزيتون، مناسبة للعائلات والمناسبات الصغيرة.',
    descriptionEn: 'Quiet istiraha among olive trees for families and small gatherings.',
    city: 'jerash',
    area: 'جرش',
    approximateAddress: 'محيط جرش',
    exactAddress: 'جرش — طريق فرعي (مخفي حتى الحجز)',
    capacity: 25,
    bedrooms: 3,
    bathrooms: 2,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: true,
    allowsOvernight: false,
    basePrice: 220,
    verificationStatus: 'owner_uploaded',
    hasPlatformDeal: true,
    ratingAvg: 4.8,
    reviewCount: 21,
    checkInTime: '10:00',
    checkOutTime: '22:00',
    amenityKeys: ['pool', 'bbq', 'garden', 'parking'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80',
        altAr: 'الاستراحة',
        altEn: 'Istiraha',
      },
    ],
    rules: [{ titleAr: 'يومي فقط — بدون مبيت', titleEn: 'Day use only' }],
    ownerIndex: 1,
  },
  {
    slug: 'farm-salt-events',
    type: 'farm',
    titleAr: 'مزرعة السلط — مناسبات وعائلات',
    titleEn: 'Salt Farm — Events & Families',
    descriptionAr: 'مساحة ترفيهية خاصة للعائلات والمناسبات مع قاعة خارجية ومسبح للأطفال.',
    descriptionEn: 'Private recreational farm for families and events with kids pool.',
    city: 'salt',
    area: 'السلط',
    approximateAddress: 'ضواحي السلط',
    exactAddress: 'السلط — منطقة سكنية (مخفي حتى الحجز)',
    capacity: 40,
    bedrooms: 2,
    bathrooms: 3,
    poolsCount: 2,
    hasIndoorPool: true,
    hasHeatedPool: false,
    hasFootballField: true,
    allowsFamilies: true,
    allowsYouth: true,
    allowsOvernight: true,
    basePrice: 300,
    verificationStatus: 'unverified',
    hasPlatformDeal: false,
    ratingAvg: 4.6,
    reviewCount: 15,
    checkInTime: '12:00',
    checkOutTime: '12:00',
    amenityKeys: ['pool', 'kids_pool', 'indoor_pool', 'bbq', 'events', 'football', 'parking'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
        altAr: 'المزرعة',
        altEn: 'Farm',
      },
    ],
    rules: [{ titleAr: 'عربون عبر المنصة عند الحجز', titleEn: 'Deposit via platform when booking' }],
    ownerIndex: 1,
  },
  {
    slug: 'chalet-madaba-mosaic',
    type: 'chalet',
    titleAr: 'شاليه مادبا — إطلالة الفسيفساء',
    titleEn: 'Madaba Mosaic Chalet',
    descriptionAr: 'شاليه عائلي أنيق قرب مادبا مع مسبح نظيف ومنطقة شواء مغطاة.',
    descriptionEn: 'Elegant family chalet near Madaba with clean pool and covered BBQ.',
    city: 'madaba',
    area: 'مادبا',
    approximateAddress: 'مادبا — ضواحي هادئة',
    exactAddress: 'مادبا (مخفي حتى الحجز)',
    capacity: 14,
    bedrooms: 3,
    bathrooms: 2,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: false,
    allowsOvernight: true,
    basePrice: 240,
    verificationStatus: 'platform_verified',
    hasPlatformDeal: true,
    ratingAvg: 4.85,
    reviewCount: 28,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    amenityKeys: ['pool', 'bbq', 'wifi', 'ac', 'parking'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
        altAr: 'شاليه مادبا',
        altEn: 'Madaba chalet',
      },
    ],
    rules: [{ titleAr: 'احترام أوقات الدخول', titleEn: 'Respect check-in times' }],
    ownerIndex: 0,
  },
  {
    slug: 'pool-house-irbid-premium',
    type: 'pool_house',
    titleAr: 'بيت مسبح إربد — خصوصية عالية',
    titleEn: 'Irbid Premium Pool House',
    descriptionAr: 'بيت مسبح خاص للعائلات الصغيرة والمجموعات الهادئة في إربد.',
    descriptionEn: 'Private pool house in Irbid for small families and quiet groups.',
    city: 'irbid',
    area: 'إربد',
    approximateAddress: 'إربد — منطقة سكنية راقية',
    exactAddress: 'إربد (مخفي حتى الحجز)',
    capacity: 12,
    bedrooms: 2,
    bathrooms: 2,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: true,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: false,
    allowsOvernight: true,
    basePrice: 195,
    verificationStatus: 'platform_reviewed',
    hasPlatformDeal: false,
    ratingAvg: 4.75,
    reviewCount: 19,
    checkInTime: '13:00',
    checkOutTime: '11:00',
    amenityKeys: ['pool', 'heated_pool', 'wifi', 'parking', 'ac'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
        altAr: 'المسبح',
        altEn: 'Pool',
      },
    ],
    rules: [{ titleAr: 'ممنوع الحفلات الصاخبة', titleEn: 'No loud parties' }],
    ownerIndex: 2,
  },
  {
    slug: 'villa-ajloun-forest',
    type: 'villa',
    titleAr: 'فيلا عجلون — بين الغابات',
    titleEn: 'Ajloun Forest Villa',
    descriptionAr: 'فيلا بإطلالة طبيعية في عجلون مع مسبح وحديقة واسعة للعائلات.',
    descriptionEn: 'Nature-view villa in Ajloun with pool and large garden.',
    city: 'ajloun',
    area: 'عجلون',
    approximateAddress: 'عجلون — منطقة خضراء',
    exactAddress: 'عجلون (مخفي حتى الحجز)',
    capacity: 20,
    bedrooms: 4,
    bathrooms: 3,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: true,
    allowsOvernight: true,
    basePrice: 265,
    verificationStatus: 'platform_verified',
    hasPlatformDeal: false,
    ratingAvg: 4.92,
    reviewCount: 36,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    amenityKeys: ['pool', 'garden', 'bbq', 'wifi', 'parking'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
        altAr: 'فيلا عجلون',
        altEn: 'Ajloun villa',
      },
    ],
    rules: [{ titleAr: 'الحفاظ على نظافة الحديقة', titleEn: 'Keep garden clean' }],
    ownerIndex: 2,
  },
  {
    slug: 'farm-zarqa-outskirts',
    type: 'farm',
    titleAr: 'مزرعة ضواحي الزرقاء — شباب وعائلات',
    titleEn: 'Zarqa Outskirts Farm',
    descriptionAr: 'مزرعة ترفيهية واسعة للشباب والعائلات مع ملعب ومسبح.',
    descriptionEn: 'Large recreational farm for youth and families with field and pool.',
    city: 'zarqa',
    area: 'ضواحي الزرقاء',
    approximateAddress: 'ضواحي الزرقاء',
    exactAddress: 'الزرقاء (مخفي حتى الحجز)',
    capacity: 35,
    bedrooms: 3,
    bathrooms: 3,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: true,
    allowsFamilies: true,
    allowsYouth: true,
    allowsOvernight: true,
    basePrice: 275,
    verificationStatus: 'owner_uploaded',
    hasPlatformDeal: true,
    ratingAvg: 4.55,
    reviewCount: 12,
    checkInTime: '12:00',
    checkOutTime: '12:00',
    amenityKeys: ['pool', 'football', 'bbq', 'parking', 'events'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1605276374101-dee2a0ed3cd6?w=1200&q=80',
        altAr: 'المزرعة',
        altEn: 'Farm',
      },
    ],
    rules: [{ titleAr: 'عدم إدخال ضيوف إضافيين', titleEn: 'No extra guests' }],
    ownerIndex: 0,
  },
  {
    slug: 'private-resort-madaba-hills',
    type: 'private_resort',
    titleAr: 'منتجع مادبا الخاص — تجربة فاخرة',
    titleEn: 'Madaba Hills Private Resort',
    descriptionAr: 'منتجع خاص صغير للمناسبات الراقية والعائلات في تلال مادبا.',
    descriptionEn: 'Small private resort for premium gatherings in Madaba hills.',
    city: 'madaba',
    area: 'تلال مادبا',
    approximateAddress: 'تلال مادبا',
    exactAddress: 'مادبا — تلال (مخفي حتى الحجز)',
    capacity: 50,
    bedrooms: 6,
    bathrooms: 5,
    poolsCount: 2,
    hasIndoorPool: true,
    hasHeatedPool: true,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: false,
    allowsOvernight: true,
    basePrice: 450,
    verificationStatus: 'platform_verified',
    hasPlatformDeal: false,
    ratingAvg: 4.95,
    reviewCount: 41,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    amenityKeys: ['pool', 'heated_pool', 'indoor_pool', 'events', 'bbq', 'wifi', 'parking', 'ac'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cd7a?w=1200&q=80',
        altAr: 'المنتجع',
        altEn: 'Resort',
      },
    ],
    rules: [
      { titleAr: 'حجز مسبق للمناسبات الكبيرة', titleEn: 'Advance booking for large events' },
    ],
    ownerIndex: 1,
  },
  {
    slug: 'chalet-salt-panorama',
    type: 'chalet',
    titleAr: 'شاليه السلط — بانوراما',
    titleEn: 'Salt Panorama Chalet',
    descriptionAr: 'شاليه عصري في السلط مع مسبح وإطلالة بانورامية للعائلات.',
    descriptionEn: 'Modern Salt chalet with pool and panorama view for families.',
    city: 'salt',
    area: 'السلط',
    approximateAddress: 'السلط — منطقة مرتفعة',
    exactAddress: 'السلط (مخفي حتى الحجز)',
    capacity: 16,
    bedrooms: 3,
    bathrooms: 2,
    poolsCount: 1,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: false,
    allowsFamilies: true,
    allowsYouth: true,
    allowsOvernight: true,
    basePrice: 210,
    verificationStatus: 'platform_reviewed',
    hasPlatformDeal: true,
    ratingAvg: 4.7,
    reviewCount: 24,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    amenityKeys: ['pool', 'bbq', 'wifi', 'parking', 'garden'],
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6a3?w=1200&q=80',
        altAr: 'شاليه السلط',
        altEn: 'Salt chalet',
      },
    ],
    rules: [{ titleAr: 'ممنوع التدخين في الداخل', titleEn: 'No indoor smoking' }],
    ownerIndex: 2,
  },
];

async function main() {
  console.log('🌱 Seeding Mazare3 database...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.auditLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.propertyAmenity.deleteMany();
  await prisma.propertyMedia.deleteMany();
  await prisma.propertyRule.deleteMany();
  await prisma.property.deleteMany();
  await prisma.ownerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.amenity.deleteMany();

  for (const a of AMENITIES) {
    await prisma.amenity.create({ data: a });
  }
  const amenityMap = Object.fromEntries(
    (await prisma.amenity.findMany()).map((a) => [a.key, a.id]),
  );

  const admin = await prisma.user.create({
    data: {
      email: 'admin@mazare3.jo',
      name: 'مدير المنصة',
      passwordHash,
      role: 'admin',
      locale: 'ar',
    },
  });

  const ownerUsers = await Promise.all(
    [
      { email: 'owner1@mazare3.jo', name: 'مالك — عمان' },
      { email: 'owner2@mazare3.jo', name: 'مالك — السلط وجرش' },
      { email: 'owner3@mazare3.jo', name: 'مالك — الشمال' },
    ].map((o) =>
      prisma.user.create({
        data: {
          email: o.email,
          name: o.name,
          passwordHash,
          role: 'owner',
          locale: 'ar',
        },
      }),
    ),
  );

  const owners = await Promise.all(
    ownerUsers.map((u, i) =>
      prisma.ownerProfile.create({
        data: {
          userId: u.id,
          displayName: u.name ?? `Owner ${i + 1}`,
          phone: `079000000${i + 1}`, // internal only — never in public API
          status: 'approved',
        },
      }),
    ),
  );

  await prisma.user.create({
    data: {
      email: 'customer@mazare3.jo',
      name: 'زبون تجريبي',
      passwordHash,
      role: 'customer',
      locale: 'ar',
    },
  });

  for (const p of PROPERTIES) {
    const owner = owners[p.ownerIndex]!;
    const property = await prisma.property.create({
      data: {
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
        checkInTime: p.checkInTime,
        checkOutTime: p.checkOutTime,
        status: PropertyStatus.published,
        verificationStatus: p.verificationStatus,
        hasPlatformDeal: p.hasPlatformDeal,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
        basePrice: p.basePrice,
        currency: 'JOD',
      },
    });

    for (const [i, img] of p.images.entries()) {
      await prisma.propertyMedia.create({
        data: {
          propertyId: property.id,
          url: img.url,
          altAr: img.altAr,
          altEn: img.altEn,
          sortOrder: i,
          verificationStatus: p.verificationStatus,
        },
      });
    }

    for (const [i, rule] of p.rules.entries()) {
      await prisma.propertyRule.create({
        data: {
          propertyId: property.id,
          titleAr: rule.titleAr,
          titleEn: rule.titleEn,
          sortOrder: i,
        },
      });
    }

    for (const key of p.amenityKeys) {
      const amenityId = amenityMap[key];
      if (amenityId) {
        await prisma.propertyAmenity.create({
          data: { propertyId: property.id, amenityId },
        });
      }
    }
  }

  const published = await prisma.property.findMany({
    where: { status: PropertyStatus.published },
    select: { id: true, basePrice: true, allowsOvernight: true },
  });

  const periods: AvailabilityPeriod[] = ['morning', 'evening', 'full_day', 'overnight'];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let slotCount = 0;

  for (const prop of published) {
    const base = Number(prop.basePrice);
    for (let dayOffset = 0; dayOffset < 45; dayOffset++) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + dayOffset);

      for (const period of periods) {
        if (period === 'overnight' && !prop.allowsOvernight) continue;

        let status: AvailabilitySlotStatus = AvailabilitySlotStatus.available;
        if (dayOffset % 7 === 0) status = AvailabilitySlotStatus.blocked;
        else if (dayOffset % 11 === 5 && period === 'full_day') status = AvailabilitySlotStatus.blocked;
        else if (dayOffset % 13 === 8 && period === 'evening') status = AvailabilitySlotStatus.blocked;

        const multiplier =
          period === 'morning' ? 0.45 : period === 'evening' ? 0.55 : period === 'overnight' ? 1.2 : 1;
        const price = Math.round(base * multiplier);

        await prisma.availabilitySlot.upsert({
          where: {
            propertyId_date_period: { propertyId: prop.id, date, period },
          },
          create: { propertyId: prop.id, date, period, price, status },
          update: { price, status },
        });
        slotCount++;
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: 'seed.completed',
      entityType: 'database',
      metadata: {
        properties: PROPERTIES.length,
        availabilitySlots: slotCount,
        demoPasswordNote: 'See README — dev only',
      },
    },
  });

  console.log(
    `✅ Seeded ${PROPERTIES.length} properties, ${slotCount} availability slots, ${AMENITIES.length} amenities, users (admin/owners/customer).`,
  );
  console.log(`   Demo password (dev only): ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
