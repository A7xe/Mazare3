/**
 * Phase 3C.4B.2B — seed Privacy Policy DRAFT only (1.1.1-advisor-revised).
 * Does NOT mutate prior privacy rows. Does NOT activate. Does NOT create acceptances.
 * Does NOT touch Terms/Cancellation/Booking 1.1.2-advisor-final.
 *
 *   pnpm --filter @mazare3/db exec dotenv -e ../../.env -- tsx prisma/seed-legal-privacy-advisor-revised.ts
 */
import {
  PrismaClient,
  LegalDocumentStatus,
  LegalDocumentType,
} from '../generated/client/index.js';

const prisma = new PrismaClient();

const CHANGELOG =
  'Phase 3C.4B.2C Privacy Policy advisor-final legal accuracy lock DRAFT (1.1.2-advisor-final) — not counsel-activated';

async function main() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production') {
    throw new Error(
      'Abort: seed-legal-privacy-advisor-revised must not run when APP_ENV=production',
    );
  }

  const {
    PRIVACY_ADVISOR_REVISED_VERSION,
    getLaunchLegalDocument,
    getLaunchLegalMarkdown,
    hashLegalContent,
    getLegalIdentityFromEnv,
    toPlaceholderValues,
  } = await import('@mazare3/shared');

  const documentType = LegalDocumentType.privacy_policy;
  const doc = getLaunchLegalDocument('privacy_policy');
  if (doc.version !== PRIVACY_ADVISOR_REVISED_VERSION) {
    throw new Error(
      `Expected privacy_policy at ${PRIVACY_ADVISOR_REVISED_VERSION}, got ${doc.version}`,
    );
  }

  const identity = getLegalIdentityFromEnv();
  const valuesEn = toPlaceholderValues(identity, 'en');
  const valuesAr = toPlaceholderValues(identity, 'ar');

  const existing = await prisma.legalRelease.findFirst({
    where: { documentType, version: PRIVACY_ADVISOR_REVISED_VERSION },
  });
  if (existing) {
    console.log(`skip existing ${documentType} ${PRIVACY_ADVISOR_REVISED_VERSION}`);
    console.log('Done. Remains DRAFT. Production not touched.');
    return;
  }

  const contentEn = getLaunchLegalMarkdown('privacy_policy', 'en', valuesEn);
  const contentAr = getLaunchLegalMarkdown('privacy_policy', 'ar', valuesAr);

  if (
    contentEn.includes('INTERNAL REVIEW ONLY') ||
    contentAr.includes('للمراجعة الداخلية فقط')
  ) {
    throw new Error('Abort: public Privacy Policy body must not contain INTERNAL REVIEW banner');
  }

  const release = await prisma.legalRelease.create({
    data: {
      documentType,
      version: PRIVACY_ADVISOR_REVISED_VERSION,
      status: LegalDocumentStatus.draft,
      requiresReacceptance: true,
      materialChange: true,
      changelog: CHANGELOG,
      summaryOfChanges: CHANGELOG,
      versions: {
        create: [
          {
            documentType,
            version: PRIVACY_ADVISOR_REVISED_VERSION,
            language: 'en',
            title: doc.titleEn,
            content: contentEn,
            contentHash: hashLegalContent(contentEn),
            status: LegalDocumentStatus.draft,
            sourceRef: `packages/shared/src/legal-content/privacy-policy.ts @ ${PRIVACY_ADVISOR_REVISED_VERSION}`,
          },
          {
            documentType,
            version: PRIVACY_ADVISOR_REVISED_VERSION,
            language: 'ar',
            title: doc.titleAr,
            content: contentAr,
            contentHash: hashLegalContent(contentAr),
            status: LegalDocumentStatus.draft,
            sourceRef: `packages/shared/src/legal-content/privacy-policy.ts @ ${PRIVACY_ADVISOR_REVISED_VERSION}`,
          },
        ],
      },
    },
  });

  console.log(
    `created DRAFT ${documentType} ${PRIVACY_ADVISOR_REVISED_VERSION} → ${release.id}`,
  );
  console.log('Done. Remains DRAFT. Production not touched. 1.1.2 contractual package untouched.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
