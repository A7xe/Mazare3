/**
 * Phase 3C.4D.3 — Owner / entity / authority foundation QA.
 * Run: pnpm qa:phase3c4d3-owner-authority
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  resolveCommissionPercentForListing,
  requiredAuthorityDocumentTypesForBasis,
  AUTHORITY_ATTESTATION_KEY,
  AUTHORITY_ATTESTATION_CORPUS_VERSION,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function expect(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}: ${detail || 'assertion failed'}`);
  }
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4D.3 Owner Authority QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const authService = src('apps/api/src/services/property-authority.service.ts');
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const bookable = src('apps/api/src/mappers/public-booking.mapper.ts');
const publicMapper = src('apps/api/src/mappers/public-property.mapper.ts');
const migration = src(
  'packages/db/prisma/migrations/20260916180000_phase3c4d3_owner_authority/migration.sql',
);

expect('A: OperatorParty model exists', schema.includes('model OperatorParty'));
expect(
  'A2: account holder relation enum distinct from Property owner',
  schema.includes('enum AccountHolderOperatorRelation') &&
    schema.includes('enum DeclaredPropertyOwnerRelation'),
);
expect(
  'B: individual entity kind supported',
  schema.includes('enum OperatorEntityKind') && /individual/.test(schema),
);
expect(
  'C: legal_entity / sole_establishment supported',
  schema.includes('legal_entity') && schema.includes('sole_establishment'),
);
expect(
  'D: representative / manager / lessee authority bases',
  schema.includes('authorised_representative') &&
    schema.includes('authorised_manager') &&
    schema.includes('lessee'),
);
expect(
  'E: authority basis required helpers for submit',
  requiredAuthorityDocumentTypesForBasis('owner').includes('property_ownership') &&
    ownerProp.includes('assertAuthorityPackageCompleteForSubmit'),
);
expect(
  'F: attestation key + corpus version',
  AUTHORITY_ATTESTATION_KEY === 'property_authority_to_offer' &&
    AUTHORITY_ATTESTATION_CORPUS_VERSION.includes('3c4d3'),
);
expect(
  'F2: OwnerAttestation model',
  schema.includes('model OwnerAttestation'),
);
expect(
  'G: private storage reuse (no public URL on OwnerDocument)',
  authService.includes('writePartnerDocumentFile') &&
    !/model OwnerDocument[\s\S]*?publicUrl/.test(schema),
);
expect(
  'G2: public property mapper has no OperatorParty / authority docs',
  !publicMapper.includes('OperatorParty') &&
    !publicMapper.includes('authorityBasis') &&
    !publicMapper.includes('contractingOperator'),
);
expect(
  'H: Owner scoped document access helper',
  authService.includes('getOwnerAccessibleAuthorityDocument') &&
    authService.includes('ownerProfileId'),
);
const patchAuthFn =
  authService.match(
    /export async function patchPropertyAuthority[\s\S]*?(?=export async function recordPropertyAuthorityAttestation)/,
  )?.[0] ?? '';
expect(
  'I: patchPropertyAuthority never sets approved',
  patchAuthFn.length > 0 &&
    !patchAuthFn.includes('authorityReviewStatus: PropertyAuthorityReviewStatus.approved') &&
    !patchAuthFn.includes('authorityReviewStatus: \'approved\''),
);
expect(
  'I2: only adminDecidePropertyAuthority sets approved',
  /adminDecidePropertyAuthority[\s\S]*PropertyAuthorityReviewStatus\.approved/.test(authService),
);
expect(
  'J: admin approve/request_changes/reject',
  authService.includes("decision === 'approve'") &&
    authService.includes('request_changes') &&
    authService.includes("decision === 'reject'"),
);
expect(
  'K: authority status enum ≠ PartnerVerificationStatus',
  schema.includes('enum PropertyAuthorityReviewStatus') &&
    schema.includes('enum PartnerVerificationStatus'),
);
expect(
  'L: VerificationStatus (platform) remains separate',
  schema.includes('enum VerificationStatus') && schema.includes('platform_verified'),
);
expect(
  'M: authority approve does not set platform_verified / 15%',
  !/adminDecidePropertyAuthority[\s\S]{0,800}platform_verified/.test(authService) &&
    resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_verified') === 15,
);
expect(
  'N: material change → reassessment_required',
  authService.includes('reassessment_required') &&
    authService.includes('authority_fields_changed'),
);
expect(
  'O: migration additive / no drop of OwnerProfile',
  migration.includes('CREATE TABLE IF NOT EXISTS "OperatorParty"') &&
    !migration.toLowerCase().includes('drop table "ownerprofile"'),
);
expect(
  'P: legacy default not_submitted (no auto-approved)',
  migration.includes("DEFAULT 'not_submitted'") &&
    migration.includes('No fabricated'),
);
const draftFn =
  ownerProp.match(
    /export async function createOwnerPropertyDraft[\s\S]*?(?=export async function )/ ,
  )?.[0] ?? '';
expect(
  'Q: draft still permissive (authority not in createOwnerPropertyDraft gate)',
  draftFn.length > 0 && !draftFn.includes('assertAuthorityPackageCompleteForSubmit'),
);
expect(
  'R: submit-review enforces authority package',
  ownerProp.includes('assertAuthorityPackageCompleteForSubmit'),
);
expect(
  'S: paid Booking gate unchanged (published + owner.approved only)',
  /isPropertyCurrentlyBookable[\s\S]*?PropertyStatus\.published/.test(bookable) &&
    bookable.includes('OwnerStatus.approved') &&
    !/isPropertyCurrentlyBookable[\s\S]{0,300}authorityReviewStatus/.test(bookable),
);
expect('T: locked legal versions', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('T2: Privacy locked', PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('T3: Owner Agreement locked', OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final');
expect(
  'U: docs exist',
  existsSync(resolve(root, 'docs/MAZARE3_OWNER_AUTHORITY_MODEL_3C4D3.md')) &&
    existsSync(resolve(root, 'docs/MAZARE3_OWNER_AUTHORITY_MIGRATION_3C4D3.md')),
);
expect(
  'Inventory: operator party processing key',
  src('packages/shared/src/privacy-processing-inventory.ts').includes(
    'owner_operator_party_and_declared_property_owner',
  ),
);
expect(
  'Audit: PropertyAuthorityReviewEvent',
  schema.includes('model PropertyAuthorityReviewEvent'),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
