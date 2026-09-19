/**
 * Phase 3C.4D.1 — Add Your Farm / Owner onboarding legal-product audit QA.
 * Run: pnpm qa:phase3c4d1-add-your-farm-audit
 *
 * AUDIT ONLY — does not change product logic, schema, legal docs, or Production.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  resolveCommissionPercentForListing,
  getLaunchLegalDocument,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}
function exists(rel: string) {
  return existsSync(resolve(root, rel));
}

console.log('\nPhase 3C.4D.1 Add Your Farm Legal Audit QA\n');

// --- A KYC documents private ---
const privateStorage = src('apps/api/src/services/partner-documents/private-storage.ts');
const partnerOnboarding = src('apps/api/src/services/partner-onboarding.service.ts');
const ownerRoutes = src('apps/api/src/routes/owner.ts');
expect(
  'A: KYC uses private storage providers',
  privateStorage.includes('cloudflare_r2_private') ||
    privateStorage.includes('s3_private') ||
    privateStorage.includes('LocalPrivateDocumentStorage'),
);
expect(
  'A2: KYC file served via authenticated owner route (not public CDN URL field)',
  ownerRoutes.includes("'/onboarding/documents/:id/file'") ||
    (ownerRoutes.includes('/onboarding/documents/') && ownerRoutes.includes('file')),
);
expect(
  'A3: OwnerDocument stores storageKey not publicUrl',
  src('packages/db/prisma/schema.prisma').includes('model OwnerDocument') &&
    src('packages/db/prisma/schema.prisma').match(
      /model OwnerDocument[\s\S]*?storageKey[\s\S]*?@@index/,
    ) != null &&
    !/model OwnerDocument[\s\S]*?publicUrl/.test(src('packages/db/prisma/schema.prisma')),
);

// --- B exact location not public ---
const publicMapper = src('apps/api/src/mappers/public-property.mapper.ts');
const locationPrivacy = src('packages/shared/src/location-privacy.ts');
expect(
  'B: public property mapper uses approximateLocation / toPublicLocation',
  publicMapper.includes('toPublicLocation') && publicMapper.includes('approximateLocation'),
);
expect(
  'B2: public property mapper does not expose exactAddress',
  !publicMapper.includes('exactAddress'),
);
expect('B3: location-privacy module present', locationPrivacy.includes('toPublicLocation'));

// --- C KYC != Platform Verification ---
const schema = src('packages/db/prisma/schema.prisma');
expect(
  'C: PartnerVerificationStatus distinct from Property VerificationStatus',
  schema.includes('enum PartnerVerificationStatus') && schema.includes('enum VerificationStatus'),
);
expect(
  'C2: platform_verified is Property VerificationStatus value',
  /enum VerificationStatus[\s\S]*?platform_verified/.test(schema),
);

// --- D Owner approval != Property verification ---
expect(
  'D: OwnerStatus and PropertyStatus are separate enums',
  schema.includes('enum OwnerStatus') && schema.includes('enum PropertyStatus'),
);
const bookable = src('apps/api/src/mappers/public-booking.mapper.ts');
expect(
  'D2: bookable requires published + owner.approved (not platform_verified)',
  bookable.includes('PropertyStatus.published') &&
    bookable.includes('OwnerStatus.approved') &&
    !/isPropertyCurrentlyBookable[\s\S]{0,200}platform_verified/.test(bookable),
);

// --- E 15% requires platform_verified ---
expect('E: standard commission = 18', STANDARD_COMMISSION_PERCENT === 18);
expect('E2: verified commission = 15', VERIFIED_COMMISSION_PERCENT === 15);
expect(
  'E3: unverified / KYC-like statuses → 18',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_reviewed') === 18 &&
    resolveCommissionPercentForListing('owner_uploaded') === 18,
);
expect(
  'E4: only platform_verified → 15',
  resolveCommissionPercentForListing('platform_verified') === 15,
);

// --- F Owner Agreement acceptance versioned ---
expect(
  'F: LegalAcceptance retains documentVersion',
  /model LegalAcceptance[\s\S]*?documentVersion\s+String/.test(schema),
);
expect(
  'F2: PartnerAgreementAcceptance exists with agreement relation',
  schema.includes('model PartnerAgreementAcceptance'),
);
const softGate = src('apps/api/src/services/legal/legal-reacceptance.service.ts');
expect(
  'F3: soft reacceptance gate for listings exists',
  softGate.includes('assertOwnerListingSoftGate'),
);

// --- G custom commercial terms require acceptance ---
const commercial = src('apps/api/src/services/commercial-terms.service.ts');
expect(
  'G: custom commercial terms acceptance gate',
  commercial.includes('COMMERCIAL_TERMS_ACCEPTANCE_REQUIRED') ||
    commercial.includes('Acceptance') ||
    commercial.includes('acceptance'),
);

// --- H payout/history not blocked by reacceptance ---
expect(
  'H: payout-profile routes do not call assertOwnerListingSoftGate',
  !/payout-profile[\s\S]{0,800}assertOwnerListingSoftGate/.test(ownerRoutes) &&
    !ownerRoutes.includes('assertOwnerListingSoftGate'),
);
expect(
  'H2: soft gate used for property listing service',
  src('apps/api/src/services/owner-property.service.ts').includes('assertOwnerListingSoftGate'),
);

// --- I Owner regulatory docs not public ---
expect(
  'I: public property mapper has no OwnerDocument / KYC document fields',
  !publicMapper.includes('OwnerDocument') &&
    !publicMapper.includes('partner-documents') &&
    !publicMapper.includes('documentType'),
);
expect(
  'I2: PartnerDocumentType has no tourism/municipal/insurance types yet (gap acknowledged)',
  /enum PartnerDocumentType[\s\S]*?payout_proof[\s\S]*?other/.test(schema) &&
    !schema.includes('tourism_classification') &&
    !schema.includes('municipal_licence'),
);

// --- J no unsupported government-verification badge ---
const en = src('apps/web/messages/en.json');
expect(
  'J: platform_verified copy is Mazare3 brand verification',
  en.includes('Verified by Mazare3') || en.includes('platform_verified'),
);
expect(
  'J2: no Ministry of Tourism licence product field / badge copy as universal requirement',
  !en.toLowerCase().includes('ministry of tourism licence') &&
    !en.toLowerCase().includes('ministry of tourism license'),
);

// --- K obsolete tourism-licence wording not assumed universally ---
expect(
  'K: no dedicated Ministry of Tourism licence schema field',
  !schema.toLowerCase().includes('ministry_of_tourism') &&
    !schema.includes('tourismLicence') &&
    !schema.includes('tourism_licence'),
);

// --- L admin actions server-authorised ---
const adminRoutes = src('apps/api/src/routes/admin.ts');
expect(
  'L: admin router uses requireAdmin',
  adminRoutes.includes('requireAdmin') && adminRoutes.includes('adminRouter.use(...requireAdmin)'),
);
expect('L2: approvePartner is admin-routed', adminRoutes.includes('approvePartner'));

// --- M historical Booking economics preserved ---
expect(
  'M: Booking commission snapshot fields present',
  schema.includes('platformCommissionPercent') &&
    schema.includes('platformCommissionAmount') &&
    schema.includes('ownerNetPayoutAmount'),
);

// --- N Production untouched (audit artifacts only) ---
expect(
  'N: audit docs exist',
  exists('docs/MAZARE3_ADD_YOUR_FARM_LEGAL_AUDIT_3C4D1.md') &&
    exists('docs/MAZARE3_OWNER_ONBOARDING_FLOW_3C4D1.md') &&
    exists('docs/MAZARE3_PROPERTY_REGULATORY_MATRIX_3C4D1.md'),
);

// --- O locked legal documents unchanged versions ---
expect('O: Terms/Booking/Cancellation version 1.1.2-advisor-final', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect(
  'O2: Privacy version 1.1.2-advisor-final',
  PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final',
);
expect(
  'O3: Owner Agreement version 1.1.1-advisor-final',
  OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final',
);
const terms = getLaunchLegalDocument('terms_and_conditions');
const privacy = getLaunchLegalDocument('privacy_policy');
const booking = getLaunchLegalDocument('booking_terms');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
expect('O4: launch Terms version locked', terms?.version === '1.1.2-advisor-final');
expect('O5: launch Privacy version locked', privacy?.version === '1.1.2-advisor-final');
expect('O6: launch Booking Terms version locked', booking?.version === '1.1.2-advisor-final');
expect('O7: launch Cancellation version locked', cancel?.version === '1.1.2-advisor-final');

// --- Publication vs Booking gate clarity ---
const ownerDocStart = schema.indexOf('model OwnerDocument {');
const ownerDocEnd = ownerDocStart >= 0 ? schema.indexOf('\nmodel ', ownerDocStart + 1) : -1;
const ownerDocBlock =
  ownerDocStart >= 0
    ? schema.slice(ownerDocStart, ownerDocEnd > 0 ? ownerDocEnd : ownerDocStart + 800)
    : '';
expect(
  'Gate: OwnerDocument has no expiresAt (expiry gap)',
  ownerDocBlock.includes('model OwnerDocument') &&
    ownerDocBlock.includes('storageKey') &&
    !/\bexpiresAt\b/.test(ownerDocBlock),
);
const partnerReqs = exists('apps/api/src/config/partner-requirements.config.ts')
  ? src('apps/api/src/config/partner-requirements.config.ts')
  : '';
expect(
  'Gate: property_ownership is a PartnerDocumentType / requirement',
  schema.includes('property_ownership') &&
    (partnerOnboarding.includes('property_ownership') ||
      partnerReqs.includes('property_ownership')),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
