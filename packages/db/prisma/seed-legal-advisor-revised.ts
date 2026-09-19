/**
 * Phase 3C.4A / 3C.4A.2 / 3C.4A.4 — seed DRAFT advisor legal docs (Terms, Cancellation, Booking Terms).
 * Does NOT mutate prior version rows. Does NOT activate. Does NOT create acceptances.
 *
 *   pnpm --filter @mazare3/db exec dotenv -e ../../.env -- tsx prisma/seed-legal-advisor-revised.ts
 */
import {
  PrismaClient,
  LegalDocumentStatus,
  LegalDocumentType,
} from '../generated/client/index.js';

const prisma = new PrismaClient();

const CHANGELOG =
  'Phase 3C.4A.4 customer legal editorial lock — Terms, Cancellation & Refund, Booking Terms (1.1.2-advisor-final)';

const DOC_TYPES = [
  'terms_and_conditions',
  'cancellation_refund_policy',
  'booking_terms',
] as const;

async function main() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production') {
    throw new Error('Abort: seed-legal-advisor-revised must not run when APP_ENV=production');
  }

  const {
    ADVISOR_REVISED_VERSION,
    getLaunchLegalDocument,
    getLaunchLegalMarkdown,
    hashLegalContent,
    getLegalIdentityFromEnv,
    toPlaceholderValues,
  } = await import('@mazare3/shared');

  const identity = getLegalIdentityFromEnv();
  const valuesEn = toPlaceholderValues(identity, 'en');
  const valuesAr = toPlaceholderValues(identity, 'ar');

  let created = 0;
  let skipped = 0;

  for (const type of DOC_TYPES) {
    const documentType = type as LegalDocumentType;
    const doc = getLaunchLegalDocument(type);
    if (doc.version !== ADVISOR_REVISED_VERSION) {
      throw new Error(
        `Expected ${type} at ${ADVISOR_REVISED_VERSION}, got ${doc.version}`,
      );
    }

    const existing = await prisma.legalRelease.findFirst({
      where: { documentType, version: ADVISOR_REVISED_VERSION },
    });
    if (existing) {
      console.log(`skip existing ${documentType} ${ADVISOR_REVISED_VERSION}`);
      skipped += 1;
      continue;
    }

    const contentEn = getLaunchLegalMarkdown(type, 'en', valuesEn);
    const contentAr = getLaunchLegalMarkdown(type, 'ar', valuesAr);

    const release = await prisma.legalRelease.create({
      data: {
        documentType,
        version: ADVISOR_REVISED_VERSION,
        status: LegalDocumentStatus.draft,
        requiresReacceptance: true,
        materialChange: true,
        changelog: CHANGELOG,
        summaryOfChanges: CHANGELOG,
        versions: {
          create: [
            {
              documentType,
              version: ADVISOR_REVISED_VERSION,
              language: 'en',
              title: doc.titleEn,
              content: contentEn,
              contentHash: hashLegalContent(contentEn),
              status: LegalDocumentStatus.draft,
              sourceRef: `packages/shared/src/legal-content (${type}) @ ${ADVISOR_REVISED_VERSION}`,
            },
            {
              documentType,
              version: ADVISOR_REVISED_VERSION,
              language: 'ar',
              title: doc.titleAr,
              content: contentAr,
              contentHash: hashLegalContent(contentAr),
              status: LegalDocumentStatus.draft,
              sourceRef: `packages/shared/src/legal-content (${type}) @ ${ADVISOR_REVISED_VERSION}`,
            },
          ],
        },
      },
    });

    console.log(`created DRAFT ${documentType} ${ADVISOR_REVISED_VERSION} → ${release.id}`);
    created += 1;
  }

  console.log(
    `Done. created=${created} skipped=${skipped}. Remains DRAFT. Production not touched.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
