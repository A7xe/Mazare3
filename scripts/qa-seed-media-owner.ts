/**
 * Local/dev only. Creates one idempotent QA owner + draft property for property-media testing.
 * Does not migrate, does not touch other users, does not create payments.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import {
  OwnerStatus,
  PartnerAgreementStatus,
  PartnerEntityType,
  PartnerVerificationStatus,
  PrismaClient,
  PropertyStatus,
  PropertyType,
  UserStatus,
} from '../packages/db/generated/client/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  config({ path: envPath, override: false });
}

const QA_EMAIL = 'owner.media.qa@mazare3.local';
const QA_PASSWORD = 'Mazare3-QA-2026!';
const QA_NAME = 'Mazare3 Media QA Owner';
const QA_SLUG = 'media-qa-farm';
const BCRYPT_ROUNDS = 12;

function failClosed(message: string): never {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

function assertLocalDevDatabase(): void {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production' || nodeEnv === 'production') {
    failClosed('APP_ENV/NODE_ENV is production. Refusing to write.');
  }
  if (appEnv && appEnv !== 'local') {
    failClosed(`APP_ENV=${appEnv} is not local. Refusing to write.`);
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl) {
    failClosed('DATABASE_URL is missing.');
  }
  let host = '';
  try {
    host = new URL(dbUrl).hostname;
  } catch {
    failClosed('DATABASE_URL is not a valid URL.');
  }
  if (/\bprod(uction)?\b/i.test(host) || /\bprod(uction)?\b/i.test(dbUrl.split('@')[1] ?? '')) {
    failClosed('Database host looks like production. Refusing to write.');
  }
  console.log(`Safety: APP_ENV=${appEnv || 'local (unset)'} NODE_ENV=${nodeEnv || 'unset'}`);
  console.log(`Safety: database host is not production (host omitted).`);
}

async function main(): Promise<void> {
  assertLocalDevDatabase();

  const prisma = new PrismaClient({ log: ['error'] });
  try {
    const existing = await prisma.user.findUnique({
      where: { email: QA_EMAIL },
      include: { ownerProfile: true },
    });

    if (existing && existing.role !== 'owner') {
      failClosed(
        `${QA_EMAIL} already exists as role=${existing.role}. Will not modify that account.`,
      );
    }

    const passwordHash =
      existing?.passwordHash && (await bcrypt.compare(QA_PASSWORD, existing.passwordHash))
        ? existing.passwordHash
        : await bcrypt.hash(QA_PASSWORD, BCRYPT_ROUNDS);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: QA_NAME,
            passwordHash,
            role: 'owner',
            status: UserStatus.active,
            locale: 'ar',
          },
        })
      : await prisma.user.create({
          data: {
            email: QA_EMAIL,
            name: QA_NAME,
            passwordHash,
            role: 'owner',
            status: UserStatus.active,
            locale: 'ar',
          },
        });

    const owner = await prisma.ownerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: QA_NAME,
        phone: '0790000099',
        city: 'amman',
        area: 'Airport Road',
        bio: 'Local QA partner account used only for property media upload testing.',
        termsAcceptedAt: new Date(),
        status: OwnerStatus.approved,
      },
      update: {
        displayName: QA_NAME,
        phone: '0790000099',
        city: 'amman',
        area: 'Airport Road',
        bio: 'Local QA partner account used only for property media upload testing.',
        termsAcceptedAt: new Date(),
        status: OwnerStatus.approved,
        rejectionReason: null,
      },
    });

    await prisma.ownerVerificationProfile.upsert({
      where: { ownerProfileId: owner.id },
      create: {
        ownerProfileId: owner.id,
        entityType: PartnerEntityType.individual,
        verificationStatus: PartnerVerificationStatus.approved,
        legalName: QA_NAME,
        operatingPhone: '0790000099',
        operatingCity: 'amman',
        operatingArea: 'Airport Road',
        contactEmail: QA_EMAIL,
        approvedAt: new Date(),
        submittedAt: new Date(),
        reviewedAt: new Date(),
        usePlatformDefaultCommission: true,
      },
      update: {
        entityType: PartnerEntityType.individual,
        verificationStatus: PartnerVerificationStatus.approved,
        legalName: QA_NAME,
        operatingPhone: '0790000099',
        operatingCity: 'amman',
        operatingArea: 'Airport Road',
        contactEmail: QA_EMAIL,
        approvedAt: new Date(),
        rejectionReason: null,
        suspensionReason: null,
        usePlatformDefaultCommission: true,
      },
    });

    const activeAgreement = await prisma.partnerAgreement.findFirst({
      where: { status: PartnerAgreementStatus.active },
      orderBy: { effectiveAt: 'desc' },
    });
    if (activeAgreement) {
      await prisma.partnerAgreementAcceptance.upsert({
        where: {
          ownerProfileId_agreementId: {
            ownerProfileId: owner.id,
            agreementId: activeAgreement.id,
          },
        },
        create: {
          ownerProfileId: owner.id,
          agreementId: activeAgreement.id,
          userId: user.id,
          acceptedAt: new Date(),
          acceptedLocale: 'ar',
        },
        update: {},
      });
    }

    let property = await prisma.property.findFirst({
      where: { ownerId: owner.id, slug: QA_SLUG },
    });
    if (!property) {
      const slugTaken = await prisma.property.findUnique({ where: { slug: QA_SLUG } });
      if (slugTaken) {
        failClosed(`Slug ${QA_SLUG} is already used by another property. Refusing to reuse it.`);
      }
      property = await prisma.property.create({
        data: {
          ownerId: owner.id,
          slug: QA_SLUG,
          type: PropertyType.farm,
          titleAr: 'مزرعة اختبار الصور',
          titleEn: 'Media QA Farm',
          descriptionAr:
            'عقار تجريبي محلي لاختبار رفع صور المزرعة وترتيبها وحذفها من لوحة المالك.',
          descriptionEn:
            'Local QA farm used only to test property photo upload, reorder, cover, and delete.',
          city: 'amman',
          area: 'Airport Road',
          approximateAddress: 'Airport Road — Amman (QA)',
          exactAddress: 'QA internal address — Airport Road, Amman',
          capacity: 12,
          bedrooms: 3,
          bathrooms: 2,
          poolsCount: 1,
          allowsFamilies: true,
          allowsYouth: false,
          allowsOvernight: true,
          instantBookingEnabled: true,
          checkInTime: '14:00',
          checkOutTime: '12:00',
          status: PropertyStatus.draft,
          basePrice: 120,
          currency: 'JOD',
        },
      });
    }

    console.log('QA_USER_ID=' + user.id);
    console.log('QA_OWNER_PROFILE_ID=' + owner.id);
    console.log('QA_PROPERTY_ID=' + property.id);
    console.log('QA_PROPERTY_SLUG=' + property.slug);
    console.log('QA_EMAIL=' + QA_EMAIL);
    console.log('REUSED=' + (existing ? 'yes' : 'no'));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
