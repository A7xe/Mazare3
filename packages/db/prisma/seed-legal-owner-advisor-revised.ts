/**
 * Phase 3C.4C.2 — seed Owner Agreement DRAFT only (1.1.0-advisor-revised).
 * Does NOT mutate prior owner_agreement rows. Does NOT activate. Does NOT create acceptances.
 * Does NOT touch locked Terms/Cancellation/Booking/Privacy corpora.
 *
 *   pnpm --filter @mazare3/db seed:legal-owner-advisor-revised
 */
import {
  PrismaClient,
  LegalDocumentStatus,
  LegalDocumentType,
} from '../generated/client/index.js';

const prisma = new PrismaClient();

const CHANGELOG =
  'Phase 3C.4C.3 Owner Agreement advisor-final DRAFT (1.1.1-advisor-final) — public-UX legal lock; not counsel-activated';

async function main() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production') {
    throw new Error(
      'Abort: seed-legal-owner-advisor-revised must not run when APP_ENV=production',
    );
  }

  const {
    OWNER_ADVISOR_REVISED_VERSION,
    getLaunchLegalDocument,
    getLaunchLegalMarkdown,
    hashLegalContent,
    getLegalIdentityFromEnv,
    toPlaceholderValues,
  } = await import('@mazare3/shared');

  const documentType = LegalDocumentType.owner_agreement;
  const doc = getLaunchLegalDocument('owner_agreement');
  if (doc.version !== OWNER_ADVISOR_REVISED_VERSION) {
    throw new Error(
      `Expected owner_agreement at ${OWNER_ADVISOR_REVISED_VERSION}, got ${doc.version}`,
    );
  }

  const identity = getLegalIdentityFromEnv();
  const valuesEn = toPlaceholderValues(identity, 'en');
  const valuesAr = toPlaceholderValues(identity, 'ar');

  const existing = await prisma.legalRelease.findFirst({
    where: { documentType, version: OWNER_ADVISOR_REVISED_VERSION },
  });
  if (existing) {
    console.log(`skip existing ${documentType} ${OWNER_ADVISOR_REVISED_VERSION}`);
    console.log('Done. Remains DRAFT. Production not touched.');
    return;
  }

  const contentEn = getLaunchLegalMarkdown('owner_agreement', 'en', valuesEn);
  const contentAr = getLaunchLegalMarkdown('owner_agreement', 'ar', valuesAr);

  if (
    contentEn.includes('INTERNAL REVIEW ONLY') ||
    contentAr.includes('للمراجعة الداخلية فقط')
  ) {
    throw new Error('Abort: Owner Agreement body must not contain INTERNAL REVIEW banner');
  }

  const release = await prisma.legalRelease.create({
    data: {
      documentType,
      version: OWNER_ADVISOR_REVISED_VERSION,
      status: LegalDocumentStatus.draft,
      requiresReacceptance: true,
      materialChange: true,
      changelog: CHANGELOG,
      summaryOfChanges: CHANGELOG,
      versions: {
        create: [
          {
            documentType,
            version: OWNER_ADVISOR_REVISED_VERSION,
            language: 'en',
            title: doc.titleEn,
            content: contentEn,
            contentHash: hashLegalContent(contentEn),
            status: LegalDocumentStatus.draft,
            sourceRef: `packages/shared/src/legal-content/owner-agreement.ts @ ${OWNER_ADVISOR_REVISED_VERSION}`,
          },
          {
            documentType,
            version: OWNER_ADVISOR_REVISED_VERSION,
            language: 'ar',
            title: doc.titleAr,
            content: contentAr,
            contentHash: hashLegalContent(contentAr),
            status: LegalDocumentStatus.draft,
            sourceRef: `packages/shared/src/legal-content/owner-agreement.ts @ ${OWNER_ADVISOR_REVISED_VERSION}`,
          },
        ],
      },
    },
  });

  console.log(
    `created DRAFT ${documentType} ${OWNER_ADVISOR_REVISED_VERSION} → ${release.id}`,
  );
  console.log(
    'Done. Remains DRAFT (not ACTIVE). No acceptances created. Production not touched.',
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
