/**
 * Phase 3C.4D.4A — Property activity + regulatory requirements foundation QA.
 * Run: pnpm qa:phase3c4d4a-regulatory-foundation
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
  isRequirementSatisfiedForReadiness,
  PROPERTY_ACTIVITY_CODES,
  REGULATORY_REQUIREMENT_TYPES,
  REGULATORY_APPLICABILITIES,
  REGULATORY_COMPLIANCE_STATUSES,
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

console.log('\nPhase 3C.4D.4A Regulatory Foundation QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const service = src('apps/api/src/services/property-regulatory.service.ts');
const sharedSchema = src('packages/shared/src/schemas/property-regulatory.ts');
const ownerRoutes = src('apps/api/src/routes/owner.ts');
const adminRoutes = src('apps/api/src/routes/admin.ts');
const bookable = src('apps/api/src/mappers/public-booking.mapper.ts');
const publicMapper = src('apps/api/src/mappers/public-property.mapper.ts');
const migration = src(
  'packages/db/prisma/migrations/20260917120000_phase3c4d4a_regulatory_foundation/migration.sql',
);
const bgJobs = src('apps/api/src/services/background-jobs.service.ts');
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const authService = src('apps/api/src/services/property-authority.service.ts');
const regulatoryConfig = src('apps/api/src/config/regulatory-config.ts');
const inventory = src('packages/shared/src/privacy-processing-inventory.ts');
const en = src('apps/web/messages/en.json');
const ar = src('apps/web/messages/ar.json');

// A — multi-select activities
expect(
  'A: PropertyActivity model + multi activity codes',
  schema.includes('model PropertyActivity') &&
    PROPERTY_ACTIVITY_CODES.includes('day_use') &&
    PROPERTY_ACTIVITY_CODES.includes('overnight_accommodation') &&
    PROPERTY_ACTIVITY_CODES.includes('swimming_pool') &&
    PROPERTY_ACTIVITY_CODES.includes('other'),
);

// B — activity ≠ automatic licence
expect(
  'B: activity not treated as automatic licence (seeds unassessed only)',
  service.includes('never auto-applicable') ||
    service.includes('never auto-applicable/verified') ||
    (service.includes('Applicability.unassessed') &&
      sharedSchema.includes('never marks applicable/verified')),
);

const overnightTypes = requirementTypesSuggestedByActivities(['overnight_accommodation']);
expect(
  'C: overnight creates tourism ASSESSMENT only',
  overnightTypes.includes('tourism_regulatory_status') &&
    !isRequirementSatisfiedForReadiness({
      applicability: 'unassessed',
      complianceStatus: 'not_assessed',
      expiresAt: null,
    }),
);

const poolTypes = requirementTypesSuggestedByActivities(['swimming_pool']);
expect(
  'D: pool creates pool ASSESSMENT only (not MoH conclusion)',
  poolTypes.includes('pool_regulatory_assessment') &&
    !poolTypes.includes('civil_liability_insurance'),
);

expect(
  'E: Owner cannot self-verify (upload → under_review only; no owner decision route)',
  service.includes('// Owner upload moves to under_review — never verified') &&
    /uploadRegulatoryEvidence[\s\S]*complianceStatus: RegulatoryComplianceStatus\.under_review/.test(
      service,
    ) &&
    !ownerRoutes.includes('/regulatory/requirements/:requirementId/decision') &&
    !ownerRoutes.includes('adminDecideRegulatoryRequirement'),
);

expect(
  'F: Owner cannot mark N/A confirmed',
  !ownerRoutes.includes('not_applicable_confirmed') &&
    !/putPropertyActivities[\s\S]{0,800}not_applicable_confirmed/.test(service) &&
    adminRoutes.includes('adminDecideRegulatoryRequirement'),
);

expect(
  'G: admin can assess applicability',
  service.includes('adminDecideRegulatoryRequirement') &&
    REGULATORY_APPLICABILITIES.includes('applicable') &&
    REGULATORY_APPLICABILITIES.includes('not_applicable_confirmed'),
);

expect(
  'H: admin verify / action_required / reject',
  REGULATORY_COMPLIANCE_STATUSES.includes('verified') &&
    REGULATORY_COMPLIANCE_STATUSES.includes('action_required') &&
    REGULATORY_COMPLIANCE_STATUSES.includes('rejected') &&
    adminRoutes.includes('/regulatory/requirements/:requirementId/decision'),
);

expect(
  'I: evidence private storage (storageKey, partner private write)',
  schema.includes('model RegulatoryEvidence') &&
    service.includes('writePartnerDocumentFile') &&
    service.includes('storageKey') &&
    !schema.includes('publicUrl'),
);

expect(
  'J: Owner evidence scoped to owned Property',
  service.includes('getOwnerAccessibleRegulatoryEvidence') &&
    service.includes('evidence.requirement.property.ownerId !== scope.ownerProfileId'),
);

expect(
  'K: public APIs expose no regulatory documents',
  !publicMapper.includes('RegulatoryEvidence') &&
    !publicMapper.includes('regulatoryRequirements') &&
    !publicMapper.includes('PropertyActivity') &&
    !publicMapper.includes('evaluatePropertyRegulatoryReadiness'),
);

expect(
  'L: applicable VERIFIED can pass readiness helper',
  isRequirementSatisfiedForReadiness({
    applicability: 'applicable',
    complianceStatus: 'verified',
    expiresAt: null,
  }) === true,
);

expect(
  'M: NOT_APPLICABLE_CONFIRMED can pass',
  isRequirementSatisfiedForReadiness({
    applicability: 'not_applicable_confirmed',
    complianceStatus: 'not_assessed',
    expiresAt: null,
  }) === true,
);

expect(
  'N: REGULATORY_CONFIRMATION_REQUIRED blocks',
  isRequirementSatisfiedForReadiness({
    applicability: 'regulatory_confirmation_required',
    complianceStatus: 'verified',
    expiresAt: null,
  }) === false &&
    service.includes('regulatory_confirmation_required'),
);

expect(
  'O: ACTION_REQUIRED blocks via applicable path',
  isRequirementSatisfiedForReadiness({
    applicability: 'applicable',
    complianceStatus: 'action_required',
    expiresAt: null,
  }) === false,
);

expect(
  'P: REJECTED blocks',
  isRequirementSatisfiedForReadiness({
    applicability: 'applicable',
    complianceStatus: 'rejected',
    expiresAt: null,
  }) === false,
);

expect(
  'Q: expired evidence/requirement blocks',
  isRequirementSatisfiedForReadiness({
    applicability: 'applicable',
    complianceStatus: 'verified',
    expiresAt: new Date(Date.now() - 86_400_000),
  }) === false && service.includes('evidenceExpired'),
);

expect(
  'R: legacy / no assessment ≠ READY',
  service.includes("readiness: 'not_started'") &&
    service.includes("readiness: 'incomplete'") &&
    service.includes('regulatory_assessment_missing') &&
    migration.includes('NOT_STARTED') &&
    migration.includes('No fabricated'),
);

expect(
  'S: activity change triggers reassessment',
  service.includes('activity_profile_changed') &&
    service.includes('markRegulatoryReassessmentRequired'),
);

expect(
  'T: operator/location reassessment hooks',
  ownerProp.includes('property_location_changed') &&
    authService.includes('authority_fields_changed') &&
    authService.includes('onPropertyRegulatoryReassessmentTrigger'),
);

expect(
  'U: auditable RegulatoryDecisionEvent + audit log',
  schema.includes('model RegulatoryDecisionEvent') &&
    service.includes('recordRegulatoryDecision') &&
    service.includes('property.regulatory_decision'),
);

expect(
  'V: platform_verified independent (commission unchanged)',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_verified') === 15 &&
    !service.includes('platform_verified'),
);

expect(
  'W: 15% commission behavior unchanged',
  resolveCommissionPercentForListing('platform_verified') === 15,
);

expect(
  'X: NEW Booking gate moved to evaluatePropertyBookability (4B); sync helper stays published+approved',
  /isPropertyCurrentlyBookable[\s\S]*?PropertyStatus\.published/.test(bookable) &&
    bookable.includes('OwnerStatus.approved') &&
    !bookable.includes('evaluatePropertyRegulatoryReadiness') &&
    src('apps/api/src/services/booking-quote.service.ts').includes(
      'assertPropertyEligibleForNewPaidBooking',
    ),
);

expect('Y: locked Terms/Cancellation/Booking version', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('Y2: Privacy locked', PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('Y3: Owner Agreement locked', OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final');

expect(
  'Z: Production untouched (migration banner + no prod cron)',
  migration.includes('Production: DO NOT APPLY') &&
    bgJobs.includes('Production cron for regulatory expiry must NOT be configured') &&
    regulatoryConfig.includes('REGULATORY_RBAC_HARDENING_PENDING'),
);

expect(
  'Municipal assessment seeded conservatively (not auto-applicable)',
  requirementTypesSuggestedByActivities(['day_use']).includes(
    'municipal_or_professional_licence',
  ) && REGULATORY_REQUIREMENT_TYPES.includes('municipal_or_professional_licence'),
);

expect(
  'Insurance NOT universally auto-seeded',
  !requirementTypesSuggestedByActivities([
    'day_use',
    'overnight_accommodation',
    'swimming_pool',
  ]).includes('civil_liability_insurance'),
);

expect(
  'Expiry warning config + reconciliation job',
  regulatoryConfig.includes('REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS') &&
    bgJobs.includes('reconcile-regulatory-document-expiry') &&
    service.includes('reconcileExpiredRegulatoryRequirements'),
);

expect(
  'Owner + Admin UI panels wired',
  existsSync(resolve(root, 'apps/web/src/components/owner/property-regulatory-panel.tsx')) &&
    existsSync(resolve(root, 'apps/web/src/components/admin/admin-property-regulatory-panel.tsx')) &&
    src('apps/web/src/components/owner/add-farm-onboarding/steps/review-step.tsx').includes(
      'PropertyRegulatoryPanel',
    ) &&
    src('apps/web/src/components/admin/admin-property-detail-view.tsx').includes(
      'AdminPropertyRegulatoryPanel',
    ),
);

expect(
  'i18n EN/AR regulatory keys',
  en.includes('"regulatory"') &&
    ar.includes('"regulatory"') &&
    ar.includes('التقييم التنظيمي') &&
    en.includes('not an automatic licence requirement'),
);

expect(
  'Privacy inventory key for regulatory evidence',
  inventory.includes('property_regulatory_evidence'),
);

expect(
  'Docs exist',
  existsSync(resolve(root, 'docs/MAZARE3_REGULATORY_REQUIREMENTS_3C4D4A.md')) &&
    existsSync(resolve(root, 'docs/MAZARE3_REGULATORY_MIGRATION_3C4D4A.md')),
);

expect(
  'Fail-closed readiness SSOT export',
  service.includes('evaluatePropertyRegulatoryReadiness') &&
    service.includes('readiness_fail_closed'),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
