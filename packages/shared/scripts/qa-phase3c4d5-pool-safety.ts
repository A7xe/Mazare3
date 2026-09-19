/**
 * Phase 3C.4D.5 — Pool & Property safety conditional compliance QA.
 * Run: pnpm qa:phase3c4d5-pool-safety
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  resolveCommissionPercentForListing,
  requirementTypesSuggestedByActivities,
  putPoolSafetyProfileSchema,
  isPoolSafetyProfileCompleteForSubmit,
  POOL_SAFETY_ATTESTATION_KEY,
  POOL_SAFETY_ATTESTATION_CORPUS_VERSION,
  amenityKeysIndicateSwimmingPool,
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

console.log('\nPhase 3C.4D.5 Pool Safety QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const service = src('apps/api/src/services/property-pool-safety.service.ts');
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const regulatory = src('apps/api/src/services/property-regulatory.service.ts');
const bookability = src('apps/api/src/services/property-bookability.service.ts');
const publicMapper = src('apps/api/src/mappers/public-property.mapper.ts');
const propertySvc = src('apps/api/src/services/property.service.ts');
const ownerRoutes = src('apps/api/src/routes/owner.ts');
const migration = src(
  'packages/db/prisma/migrations/20260917180000_phase3c4d5_pool_safety/migration.sql',
);
const disclosure = src(
  'apps/web/src/components/marketplace/property-pool-safety-disclosure.tsx',
);
const en = src('apps/web/messages/en.json');
const ar = src('apps/web/messages/ar.json');

expect(
  'A: PropertyPoolSafetyProfile model',
  schema.includes('model PropertyPoolSafetyProfile') &&
    schema.includes('minDepthMeters') &&
    schema.includes('childrenRequireAdultSupervision'),
);

expect(
  'B: non-pool not forced — assert returns early when !offers',
  service.includes('if (!offers) return'),
);

expect(
  'C: swimming_pool triggers pool_regulatory_assessment',
  requirementTypesSuggestedByActivities(['swimming_pool']).includes(
    'pool_regulatory_assessment',
  ),
);

expect(
  'D: does NOT auto-mean MoH licence',
  service.includes('Does NOT auto-verify') &&
    !service.includes('Ministry of Health pool licence required') &&
    en.includes('not a government licence'),
);

expect(
  'E: Owner cannot mark pool requirement N/A/verified',
  !ownerRoutes.includes('not_applicable_confirmed') &&
    !/putPoolSafetyProfile[\s\S]{0,500}verified/.test(service) &&
    regulatory.includes('adminDecideRegulatoryRequirement'),
);

expect(
  'F: attestation required before pool Property submit',
  ownerProp.includes('assertPoolSafetyCompleteForSubmit') &&
    service.includes('POOL_SAFETY_ATTESTATION_REQUIRED'),
);

expect(
  'G: attestation versioned',
  POOL_SAFETY_ATTESTATION_KEY === 'property_pool_safety_disclosure' &&
    POOL_SAFETY_ATTESTATION_CORPUS_VERSION.includes('3c4d5') &&
    service.includes('ownerAttestation.create'),
);

expect(
  'H: private regulatory evidence remains private storage path',
  regulatory.includes('writePartnerDocumentFile') &&
    !publicMapper.includes('RegulatoryEvidence'),
);

expect(
  'I: public API factual disclosure only',
  propertySvc.includes('getPublicPoolSafetyDisclosure') &&
    service.includes("depthSource: 'owner_provided'") &&
    disclosure.includes('ownerProvided'),
);

const publicFn =
  service.match(
    /export async function getPublicPoolSafetyDisclosure[\s\S]*?(?=export async function adminGetPoolSafety)/,
  )?.[0] ?? '';
expect(
  'J: public disclosure has no admin notes / evidence',
  publicFn.length > 0 &&
    !publicFn.includes('reviewReason') &&
    !publicFn.includes('storageKey') &&
    publicFn.includes('disclaimerKey'),
);

expect(
  'K: no government approved/safe/certified badge',
  !disclosure.includes('Government approved') &&
    !disclosure.includes('Certified safe') &&
    en.includes('does not certify government approval') &&
    ar.includes('لا تعتمد مزارع موافقة حكومية'),
);

expect(
  'L: min/max depth validation',
  putPoolSafetyProfileSchema.safeParse({
    minDepthMeters: 2,
    maxDepthMeters: 1,
  }).success === false &&
    putPoolSafetyProfileSchema.safeParse({
      minDepthMeters: 1,
      maxDepthMeters: 2,
    }).success === true,
);

expect(
  'M: activity/amenity/count inconsistency detection',
  service.includes('detectPoolConsistency') &&
    service.includes('pools_count_without_activity') &&
    amenityKeysIndicateSwimmingPool(['pool']) === true &&
    amenityKeysIndicateSwimmingPool(['kids_pool']) === false,
);

expect(
  'N: adding pool triggers regulatory reassessment',
  service.includes('pool_listing_signals_changed') &&
    service.includes('onPropertyRegulatoryReassessmentTrigger'),
);

expect(
  'O: removing pool does not self-mark N/A',
  service.includes('Do NOT auto-deactivate') ||
    service.includes('must not self-mark regulatory N/A'),
);

expect(
  'P: material pool facts trigger reassessment',
  service.includes('pool_safety_facts_changed'),
);

expect(
  'Q: platform_verified separate',
  service.includes('doesNotGrantPlatformVerified: true') &&
    resolveCommissionPercentForListing('platform_verified') === 15,
);

expect(
  'R: 15% commission unchanged',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_verified') === 15,
);

expect(
  'S: existing bookability reused (no duplicate pool Booking gate)',
  !bookability.includes('poolSafety') &&
    !bookability.includes('PropertyPoolSafety') &&
    bookability.includes('evaluatePropertyRegulatoryReadiness'),
);

expect(
  'T: unresolved pool assessment blocks via READY gate',
  requirementTypesSuggestedByActivities(['swimming_pool']).includes(
    'pool_regulatory_assessment',
  ) && bookability.includes("readiness !== 'ready'"),
);

expect(
  'U: no auto-cancel confirmed Bookings in pool safety service',
  !service.includes('BookingStatus.cancelled'),
);

expect(
  'V: no refund/penalty logic',
  !service.includes('createRefund') && !service.includes('OwnerFinancialAdjustment'),
);

expect('W: locked legal docs', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('W2: Privacy', PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('W3: OA', OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final');

expect(
  'X: Production untouched (migration banner)',
  migration.includes('Production') || migration.includes('Local/dev only'),
);

expect(
  'Profile complete helper',
  isPoolSafetyProfileCompleteForSubmit({
    waterFeatureKind: 'swimming_pool',
    childrenRequireAdultSupervision: true,
    seasonality: 'permanent',
  }) === true &&
    isPoolSafetyProfileCompleteForSubmit({
      waterFeatureKind: 'swimming_pool',
      childrenRequireAdultSupervision: null,
      seasonality: 'permanent',
    }) === false,
);

expect(
  'Docs + UI wired',
  existsSync(resolve(root, 'docs/MAZARE3_POOL_SAFETY_COMPLIANCE_3C4D5.md')) &&
    existsSync(resolve(root, 'docs/MAZARE3_POOL_SAFETY_PREFLIGHT_3C4D5.md')) &&
    existsSync(
      resolve(root, 'apps/web/src/components/owner/property-pool-safety-panel.tsx'),
    ) &&
    src('apps/web/src/components/owner/add-farm-onboarding/steps/review-step.tsx').includes(
      'PropertyPoolSafetyPanel',
    ),
);

expect(
  'REGULATORY_RBAC_HARDENING_PENDING still documented',
  src('apps/api/src/config/regulatory-config.ts').includes('REGULATORY_RBAC_HARDENING_PENDING'),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
