import {
  LEGAL_BOOTSTRAP_CHANGELOG,
  LEGAL_REVIEW_BANNER,
  assertLegalIdentityReadyForProduction,
  findUnresolvedLegalPlaceholders,
  getLegalIdentityFromEnv,
  hashLegalContent,
} from '@mazare3/shared';
import { LegalDocumentStatus, LegalDocumentType, prisma } from '@mazare3/db';
import { AppError } from '../../lib/errors.js';

const PLACEHOLDER_CONTENT_MARKER =
  'placeholder content for architecture bootstrap';

const PHASE3B_CHANGELOG_MARKER = 'Phase 3B architecture bootstrap';

/** Required ACTIVE document types for Production public marketplace legal. */
const REQUIRED_ACTIVE_DOCUMENT_TYPES: LegalDocumentType[] = [
  LegalDocumentType.terms_and_conditions,
  LegalDocumentType.privacy_policy,
  LegalDocumentType.cancellation_refund_policy,
  LegalDocumentType.booking_terms,
];

const REQUIRED_LANGUAGES = ['ar', 'en'] as const;

function isProductionRuntime(): boolean {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  return appEnv === 'production' || nodeEnv === 'production';
}

function allowLaunchCandidateActive(): boolean {
  // Local override only — never honoured in Production runtime.
  if (isProductionRuntime()) return false;
  const raw = (process.env.LEGAL_ALLOW_LAUNCH_CANDIDATE_ACTIVE ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value.trim());
}

/**
 * Production boot / publish guard: ACTIVE legal must be counsel-ready.
 *
 * HARD FAIL in production when:
 * 1. ACTIVE content/version/changelog carries placeholder / bootstrap / Phase 3B markers
 * 2. Unresolved [[TOKEN]] in any ACTIVE required document (always — not only STRICT)
 * 3. Missing ACTIVE required types (terms, privacy, cancellation, booking_terms)
 *    + missing ACTIVE owner_agreement when owner marketplace ops need it
 * 4. Missing AR or EN for each required ACTIVE release
 * 5. Missing/invalid contentHash (or hash ≠ content)
 * 6. ACTIVE version contains 'launch-candidate' (LEGAL_ALLOW_LAUNCH_CANDIDATE_ACTIVE
 *    local override is never honoured in Production)
 * 7. assertLegalIdentityReadyForProduction fails
 * 8. Draft status somehow treated as active (release/version status mismatch)
 */
export async function assertProductionLegalReady(): Promise<void> {
  if (!isProductionRuntime()) return;

  const hardFailures: string[] = [];

  try {
    assertLegalIdentityReadyForProduction(getLegalIdentityFromEnv());
  } catch (err) {
    hardFailures.push(err instanceof Error ? err.message : String(err));
  }

  const activeReleases = await prisma.legalRelease.findMany({
    where: { status: LegalDocumentStatus.active },
    include: { versions: true },
  });

  const activeByType = new Map(
    activeReleases.map((r) => [r.documentType, r] as const),
  );

  for (const docType of REQUIRED_ACTIVE_DOCUMENT_TYPES) {
    if (!activeByType.has(docType)) {
      hardFailures.push(`Missing ACTIVE required document type: ${docType}`);
    }
  }

  const ownerAgreement = activeByType.get(LegalDocumentType.owner_agreement);
  if (!ownerAgreement) {
    hardFailures.push(
      'Missing ACTIVE owner_agreement (required for owner marketplace operations)',
    );
  }

  for (const release of activeReleases) {
    const label = `${release.documentType}@${release.version}`;
    const versionLower = release.version.toLowerCase();

    if (versionLower.includes('placeholder')) {
      hardFailures.push(
        `ACTIVE ${label}: version string includes 'placeholder'`,
      );
    }

    if (
      versionLower.includes('launch-candidate') &&
      !allowLaunchCandidateActive()
    ) {
      hardFailures.push(
        `ACTIVE ${label}: version contains 'launch-candidate' (not approved for Production; LEGAL_ALLOW_LAUNCH_CANDIDATE_ACTIVE is ignored in Production)`,
      );
    }

    const metaTexts = [release.changelog ?? '', release.summaryOfChanges ?? ''];
    for (const text of metaTexts) {
      const lower = text.toLowerCase();
      if (lower.includes('placeholder')) {
        hardFailures.push(
          `ACTIVE ${label}: changelog/summary contains 'placeholder'`,
        );
      }
      if (text.includes(LEGAL_REVIEW_BANNER) || lower.includes(PLACEHOLDER_CONTENT_MARKER)) {
        hardFailures.push(
          `ACTIVE ${label}: still carries LEGAL_REVIEW_BANNER / Phase 3B bootstrap banner`,
        );
      }
      if (
        text.includes(LEGAL_BOOTSTRAP_CHANGELOG) ||
        text.includes(PHASE3B_CHANGELOG_MARKER)
      ) {
        hardFailures.push(
          `ACTIVE ${label}: still carries Phase 3B bootstrap changelog marker`,
        );
      }
    }

    // Draft must never be treated as active.
    if (release.status === LegalDocumentStatus.draft) {
      hardFailures.push(
        `Release ${label} has status draft but was loaded as ACTIVE — status inconsistency`,
      );
    }

    for (const lang of REQUIRED_LANGUAGES) {
      const version = release.versions.find((v) => v.language === lang);
      if (!version) {
        // Only hard-fail language gaps for required types + owner_agreement.
        const isRequired =
          REQUIRED_ACTIVE_DOCUMENT_TYPES.includes(release.documentType) ||
          release.documentType === LegalDocumentType.owner_agreement;
        if (isRequired) {
          hardFailures.push(
            `ACTIVE ${release.documentType}@${release.version}: missing language version ${lang}`,
          );
        }
        continue;
      }

      if (version.status === LegalDocumentStatus.draft) {
        hardFailures.push(
          `ACTIVE ${release.documentType}@${release.version}/${lang}: version row status is draft while release is ACTIVE`,
        );
      }
      if (version.status !== LegalDocumentStatus.active) {
        hardFailures.push(
          `ACTIVE ${release.documentType}@${release.version}/${lang}: version status is '${version.status}' (expected active)`,
        );
      }

      const content = version.content ?? '';
      if (
        content.toLowerCase().includes(PLACEHOLDER_CONTENT_MARKER) ||
        content.includes(LEGAL_REVIEW_BANNER) ||
        content.toLowerCase().includes('placeholder')
      ) {
        hardFailures.push(
          `ACTIVE ${release.documentType}@${release.version}/${lang}: content contains placeholder / bootstrap banner`,
        );
      }

      const unresolved = findUnresolvedLegalPlaceholders(content);
      if (unresolved.length > 0) {
        hardFailures.push(
          `ACTIVE ${release.documentType}@${release.version}/${lang}: unresolved identity tokens ${unresolved.join(', ')}`,
        );
      }

      const hash = (version.contentHash ?? '').trim();
      if (!hash || !isSha256Hex(hash)) {
        hardFailures.push(
          `ACTIVE ${release.documentType}@${release.version}/${lang}: missing or invalid contentHash`,
        );
      } else {
        const expected = hashLegalContent(content);
        if (expected !== hash) {
          hardFailures.push(
            `ACTIVE ${release.documentType}@${release.version}/${lang}: contentHash does not match content`,
          );
        }
      }
    }
  }

  const uniqueHard = [...new Set(hardFailures)];
  if (uniqueHard.length > 0) {
    throw new Error(
      `[legal-production-guard] Refusing to boot / operate with non-ready ACTIVE legal in production:\n- ${uniqueHard.join('\n- ')}`,
    );
  }
}

/** Hard-block Phase 3B bootstrap endpoint outside non-production environments. */
export function assertBootstrapPlaceholdersAllowed(): void {
  if (isProductionRuntime()) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'POST /admin/legal/bootstrap-placeholders is forbidden when APP_ENV or NODE_ENV is production',
    );
  }
}
