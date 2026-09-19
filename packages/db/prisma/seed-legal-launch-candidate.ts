/**
 * Phase 3C.1 / 3C.3 — seed DRAFT launch-candidate legal releases (AR + EN).
 *
 * Phase 3C.3 seeds version `1.0.1-launch-candidate` with founder-confirmed
 * identity placeholders filled from Legal Identity SSOT. Unresolved privacy /
 * DPO / PSP tokens remain as [[TOKEN]].
 *
 * Phase 3C.4C.2: owner_agreement content is taken from the frozen
 * ownerAgreementLaunchCandidate corpus (not the active 1.1.0 advisor draft).
 *
 * Does NOT activate releases or mutate/supersede placeholder ACTIVE versions.
 * Does NOT mutate existing `1.0.0-launch-candidate` DRAFT rows (new version).
 * Does NOT create any user acceptances.
 *
 * Usage (local only):
 *   dotenv -e ../../.env -- tsx prisma/seed-legal-launch-candidate.ts
 *   pnpm --filter @mazare3/db seed:legal-launch
 */
import {
  PrismaClient,
  LegalDocumentStatus,
  LegalDocumentType,
} from '../generated/client/index.js';

const prisma = new PrismaClient();

const CHANGELOG =
  'Phase 3C.3 launch-candidate bilingual legal corpus — founder legal identity integrated; privacy/DPO/PSP placeholders remain for counsel review';

async function main() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (appEnv === 'production') {
    throw new Error('Abort: seed-legal-launch-candidate must not run when APP_ENV=production');
  }

  const {
    LAUNCH_CANDIDATE_VERSION,
    getLaunchLegalDocument,
    getLaunchLegalMarkdown,
    listLaunchLegalDocuments,
    hashLegalContent,
    getLegalIdentityFromEnv,
    toPlaceholderValues,
    fillPlaceholders,
    ownerAgreementLaunchCandidate,
  } = await import('@mazare3/shared');

  const identity = getLegalIdentityFromEnv();
  const valuesEn = toPlaceholderValues(identity, 'en');
  const valuesAr = toPlaceholderValues(identity, 'ar');

  const docs = listLaunchLegalDocuments();
  let created = 0;
  let skipped = 0;

  for (const doc of docs) {
    const documentType = doc.documentType as LegalDocumentType;

    const existing = await prisma.legalRelease.findFirst({
      where: {
        documentType,
        version: LAUNCH_CANDIDATE_VERSION,
      },
    });
    if (existing) {
      console.log(`skip existing ${documentType} ${LAUNCH_CANDIDATE_VERSION} (${existing.status})`);
      skipped += 1;
      continue;
    }

    let contentEn: string;
    let contentAr: string;
    let titleEn = doc.titleEn;
    let titleAr = doc.titleAr;
    let sourceRef = `packages/shared/src/legal-content (${doc.documentType}) @ ${LAUNCH_CANDIDATE_VERSION}`;

    if (documentType === LegalDocumentType.owner_agreement) {
      // Preserve true 1.0.1 corpus after active OA advanced to advisor-revised.
      if (ownerAgreementLaunchCandidate.version !== LAUNCH_CANDIDATE_VERSION) {
        throw new Error(
          `Frozen ownerAgreementLaunchCandidate must be ${LAUNCH_CANDIDATE_VERSION}`,
        );
      }
      contentEn = fillPlaceholders(ownerAgreementLaunchCandidate.markdownEn, valuesEn);
      contentAr = fillPlaceholders(ownerAgreementLaunchCandidate.markdownAr, valuesAr);
      titleEn = ownerAgreementLaunchCandidate.titleEn;
      titleAr = ownerAgreementLaunchCandidate.titleAr;
      sourceRef = `packages/shared/src/legal-content/owner-agreement-launch-candidate.ts @ ${LAUNCH_CANDIDATE_VERSION}`;
    } else if (
      documentType === LegalDocumentType.privacy_policy &&
      getLaunchLegalDocument('privacy_policy').version !== LAUNCH_CANDIDATE_VERSION
    ) {
      const {
        privacyPolicyLaunchCandidate,
      } = await import('@mazare3/shared');
      contentEn = fillPlaceholders(privacyPolicyLaunchCandidate.markdownEn, valuesEn);
      contentAr = fillPlaceholders(privacyPolicyLaunchCandidate.markdownAr, valuesAr);
      titleEn = privacyPolicyLaunchCandidate.titleEn;
      titleAr = privacyPolicyLaunchCandidate.titleAr;
      sourceRef = `packages/shared/src/legal-content/privacy-policy-launch-candidate.ts @ ${LAUNCH_CANDIDATE_VERSION}`;
    } else {
      contentEn = getLaunchLegalMarkdown(doc.documentType, 'en', valuesEn);
      contentAr = getLaunchLegalMarkdown(doc.documentType, 'ar', valuesAr);
    }

    const release = await prisma.legalRelease.create({
      data: {
        documentType,
        version: LAUNCH_CANDIDATE_VERSION,
        status: LegalDocumentStatus.draft,
        requiresReacceptance: true,
        materialChange: true,
        changelog: CHANGELOG,
        summaryOfChanges: CHANGELOG,
        versions: {
          create: [
            {
              documentType,
              version: LAUNCH_CANDIDATE_VERSION,
              language: 'en',
              title: titleEn,
              content: contentEn,
              contentHash: hashLegalContent(contentEn),
              status: LegalDocumentStatus.draft,
              sourceRef,
            },
            {
              documentType,
              version: LAUNCH_CANDIDATE_VERSION,
              language: 'ar',
              title: titleAr,
              content: contentAr,
              contentHash: hashLegalContent(contentAr),
              status: LegalDocumentStatus.draft,
              sourceRef,
            },
          ],
        },
      },
    });

    console.log(`created DRAFT ${documentType} ${LAUNCH_CANDIDATE_VERSION} → ${release.id}`);
    created += 1;
  }

  console.log(
    `Done. created=${created} skipped=${skipped}. All ${LAUNCH_CANDIDATE_VERSION} releases remain DRAFT (not ACTIVE). No user acceptances created. Production was not touched.`,
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
