/**
 * Phase 3B — bootstrap ACTIVE placeholder legal releases.
 * Does NOT create any user acceptances.
 *
 * Usage (local only):
 *   dotenv -e ../../.env -- tsx prisma/seed-legal-bootstrap.ts
 */
import { createHash } from 'node:crypto';
import { PrismaClient, LegalDocumentStatus, LegalDocumentType } from '../generated/client/index.js';

const prisma = new PrismaClient();

const CHANGELOG =
  'Phase 3B architecture bootstrap — placeholder pending Phase 3C final legal rewrite';
const BANNER =
  'REQUIRES JORDANIAN LEGAL REVIEW — placeholder content for architecture bootstrap only.';

function hashContent(content: string): string {
  return createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

async function ensureRelease(
  documentType: LegalDocumentType,
  titles: { ar: string; en: string },
  sourceRef: string,
) {
  const existing = await prisma.legalRelease.findFirst({
    where: { documentType, status: LegalDocumentStatus.active },
  });
  if (existing) {
    console.log(`skip active ${documentType}`);
    return;
  }

  const version = '1.0.0-placeholder';
  const contentEn = `${BANNER}\n\n# ${titles.en}\n\nPlaceholder from Phase 3B bootstrap. SourceRef: ${sourceRef}`;
  const contentAr = `${BANNER}\n\n# ${titles.ar}\n\nمحتوى مؤقت لمرحلة 3B. SourceRef: ${sourceRef}`;

  const release = await prisma.legalRelease.create({
    data: {
      documentType,
      version,
      status: LegalDocumentStatus.active,
      requiresReacceptance: false,
      materialChange: false,
      changelog: CHANGELOG,
      summaryOfChanges: CHANGELOG,
      publishedAt: new Date(),
      effectiveAt: new Date(),
      versions: {
        create: [
          {
            documentType,
            version,
            language: 'en',
            title: titles.en,
            content: contentEn,
            contentHash: hashContent(contentEn),
            status: LegalDocumentStatus.active,
            publishedAt: new Date(),
            effectiveAt: new Date(),
            sourceRef,
          },
          {
            documentType,
            version,
            language: 'ar',
            title: titles.ar,
            content: contentAr,
            contentHash: hashContent(contentAr),
            status: LegalDocumentStatus.active,
            publishedAt: new Date(),
            effectiveAt: new Date(),
            sourceRef,
          },
        ],
      },
    },
  });
  console.log(`created ${documentType} release ${release.id}`);
}

async function main() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production') {
    throw new Error('Abort: seed-legal-bootstrap must not run when APP_ENV=production');
  }

  await ensureRelease(
    LegalDocumentType.terms_and_conditions,
    { en: 'Terms & Conditions', ar: 'الشروط والأحكام' },
    'apps/web/src/content/legal/terms.ts',
  );
  await ensureRelease(
    LegalDocumentType.privacy_policy,
    { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
    'apps/web/src/content/legal/privacy.ts',
  );
  await ensureRelease(
    LegalDocumentType.cancellation_refund_policy,
    { en: 'Cancellation & Refund Policy', ar: 'سياسة الإلغاء والاسترداد' },
    'apps/web/src/content/legal/cancellation.ts',
  );
  await ensureRelease(
    LegalDocumentType.booking_terms,
    { en: 'Booking & Payment Policy', ar: 'سياسة الحجز والدفع' },
    'apps/web/src/content/legal/booking-payment.ts',
  );
  await ensureRelease(
    LegalDocumentType.owner_agreement,
    { en: 'Owner / Partner Agreement', ar: 'اتفاقية الشريك' },
    'PartnerAgreement + Phase 3C',
  );

  console.log('Done. No user acceptances created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
