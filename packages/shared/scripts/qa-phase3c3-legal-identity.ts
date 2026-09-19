/**
 * Phase 3C.3 — Founder legal identity integration QA.
 * Run: pnpm qa:phase3c3-legal-identity
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDER_CONFIRMED_LEGAL_IDENTITY,
  LAUNCH_CANDIDATE_VERSION,
  assertLegalEntityNameExcludesForm,
  assertLegalIdentityReadyForProduction,
  fillPlaceholders,
  formatLegalEntityIntroAr,
  formatLegalEntityIntroEn,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  listFounderInputRequired,
  listLaunchLegalDocuments,
  toPlaceholderValues,
  LEGAL_CONTENT_PLACEHOLDERS,
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
function has(rel: string, needle: string | RegExp, label: string) {
  const body = src(rel);
  const ok = typeof needle === 'string' ? body.includes(needle) : needle.test(body);
  expect(label, ok, `missing in ${rel}`);
}
function exists(rel: string, label: string) {
  expect(label, existsSync(resolve(root, rel)));
}

console.log('\nPhase 3C.3 Founder Legal Identity Integration QA\n');

const identity = getLegalIdentityFromEnv();
const founder = FOUNDER_CONFIRMED_LEGAL_IDENTITY;

// A. Legal entity name AR does NOT contain legal form
{
  expect(
    'A AR entity name excludes ذات مسؤولية محدودة',
    assertLegalEntityNameExcludesForm(identity.legalEntityNameAr) &&
      identity.legalEntityNameAr === founder.legalEntityNameAr &&
      !identity.legalEntityNameAr!.includes('ذات مسؤولية محدودة'),
  );
}

// B. Legal form AR separate
{
  expect(
    'B legalFormAr = شركة ذات مسؤولية محدودة',
    identity.legalFormAr === 'شركة ذات مسؤولية محدودة',
  );
}

// C. English entity and form separate
{
  expect(
    'C EN entity separate from form',
    identity.legalEntityNameEn === 'BATMAN TECHNOLOGY' &&
      identity.legalFormEn === 'Limited Liability Company (LLC)' &&
      !identity.legalEntityNameEn!.toLowerCase().includes('limited liability'),
  );
}

// D / E registration numbers
{
  expect('D CR = 62272', identity.commercialRegistrationNumber === '62272');
  expect(
    'E national establishment = 200185304',
    identity.nationalEstablishmentNumber === '200185304' &&
      identity.nationalEstablishmentNumber !== identity.commercialRegistrationNumber,
  );
}

// F address AR/EN
{
  expect(
    'F address AR resolves',
    Boolean(identity.registeredAddressAr?.includes('مجمع الباسم 2')) &&
      Boolean(identity.registeredAddressAr?.includes('عمّان')),
  );
  expect(
    'F address EN resolves',
    Boolean(identity.registeredAddressEn?.includes('Al-Basem Complex 2')) &&
      Boolean(identity.registeredAddressEn?.includes('Amman')),
  );
}

// G / H emails
{
  expect('G legal contact = info@battechno.com', identity.legalContactEmail === 'info@battechno.com');
  expect(
    'H ops email = mazare3jo@gmail.com',
    identity.projectOperationalEmail === 'mazare3jo@gmail.com' &&
      identity.legalContactEmail !== identity.projectOperationalEmail,
  );
}

// I / J partnership phone placement
{
  const partnerLanding = src(
    'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
  );
  const contactIdentity = src('apps/web/src/components/legal/contact-identity.tsx');
  const contactPage = src('apps/web/src/components/legal/contact-page-view.tsx');
  const siteIdentity = src('apps/web/src/lib/legal/site-identity.ts');

  expect(
    'I partnership phone on Become Owner surface',
    partnerLanding.includes('FOUNDER_CONFIRMED_LEGAL_IDENTITY') &&
      partnerLanding.includes('partner-partnership-phone') &&
      partnerLanding.includes('@mazare3/shared/legal-identity') &&
      identity.partnershipContactPhone === '+962 7 9605 3210',
  );
  expect(
    'J partnership phone NOT customer support/legal/privacy contact',
    contactIdentity.includes('Do NOT show partnershipContactPhone') &&
      contactPage.includes('Partnership phone must never appear') &&
      siteIdentity.includes('must NOT be partnership phone') &&
      identity.supportPhone == null,
  );
  // Ensure contact surfaces do not hardcode the partnership number
  expect(
    'J partnership number not hardcoded on contact pages',
    !contactIdentity.includes('9605 3210') && !contactPage.includes('9605 3210'),
  );
}

// K no individual national IDs from certificate in public legal config/content
{
  const forbiddenIds = ['200185304'.length]; // smoke — check known personal-id patterns absent
  const legalIdentitySrc = src('packages/shared/src/legal-identity.ts');
  const corpus = listLaunchLegalDocuments()
    .map((d) => d.markdownEn + d.markdownAr)
    .join('\n');
  // National establishment number may exist in SSOT but must not be treated as personal NID.
  // Block common Jordanian personal ID length dumps / certificate extras.
  const personalIdLeak =
    /\b\d{10}\b/.test(corpus) ||
    corpus.includes('رقم وطني') ||
    legalIdentitySrc.includes('shareholderNationalId') ||
    legalIdentitySrc.includes('nationalId');
  expect('K no personal national IDs in public legal corpus/config', !personalIdLeak);
  void forbiddenIds;
}

// L remaining privacy/PSP placeholders flagged
{
  const missing = listFounderInputRequired(identity);
  const keys = missing.map((m) => m.key);
  expect(
    'L privacy contact still unresolved',
    keys.includes('privacyContactEmail') && identity.privacyContactEmail == null,
  );
  expect(
    'L DPO/privacy contact still unresolved',
    keys.includes('dpoOrPrivacyContact') && identity.dpoOrPrivacyContact == null,
  );
  expect(
    'L PSP legal name still unresolved',
    keys.includes('paymentProviderLegalName') && identity.paymentProviderLegalName == null,
  );
  expect(
    'L unresolved tokens remain in Privacy Policy when unfilled',
    getLaunchLegalMarkdown('privacy_policy', 'en').includes(
      LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL,
    ) &&
      getLaunchLegalMarkdown('privacy_policy', 'en').includes(
        LEGAL_CONTENT_PLACEHOLDERS.DPO_OR_PRIVACY_CONTACT,
      ) &&
      getLaunchLegalMarkdown('privacy_policy', 'en').includes(
        LEGAL_CONTENT_PLACEHOLDERS.PAYMENT_PROVIDER_LEGAL_NAME,
      ),
  );
}

// M / N production guard identity behavior
{
  let threw = false;
  let message = '';
  try {
    assertLegalIdentityReadyForProduction(identity);
  } catch (e) {
    threw = true;
    message = e instanceof Error ? e.message : String(e);
  }
  expect('N Production identity guard still blocks unresolved items', threw);
  expect(
    'M Production guard does NOT flag resolved entity/CR/address/legal email',
    threw &&
      !message.includes('legalEntityName') &&
      !message.includes('commercialRegistration') &&
      !message.includes('registeredAddress') &&
      !message.includes('legalContactEmail') &&
      message.includes('privacyContactEmail') &&
      message.includes('paymentProviderLegalName'),
  );
}

// O AR/EN legal pages resolve company identity from SSOT
{
  const valuesEn = toPlaceholderValues(identity, 'en');
  const valuesAr = toPlaceholderValues(identity, 'ar');
  const termsEn = getLaunchLegalMarkdown('terms_and_conditions', 'en', valuesEn);
  const termsAr = getLaunchLegalMarkdown('terms_and_conditions', 'ar', valuesAr);
  expect(
    'O EN terms resolve BATMAN TECHNOLOGY intro from SSOT',
    termsEn.includes('BATMAN TECHNOLOGY') &&
      termsEn.includes('62272') &&
      termsEn.includes('info@battechno.com') &&
      !termsEn.includes(LEGAL_CONTENT_PLACEHOLDERS.LEGAL_ENTITY_INTRO_EN) &&
      !termsEn.includes(LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL),
  );
  expect(
    'O AR terms resolve Arabic entity intro from SSOT',
    termsAr.includes('شركة الرجل الوطواط للتكنولوجيا') &&
      termsAr.includes('شركة ذات مسؤولية محدودة') &&
      termsAr.includes('62272') &&
      !termsAr.includes('شركة الرجل الوطواط للتكنولوجيا ذات مسؤولية محدودة') &&
      !termsAr.includes(LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL),
  );
  const introEn = formatLegalEntityIntroEn(identity);
  const introAr = formatLegalEntityIntroAr(identity);
  expect(
    'O preferred intro patterns',
    introEn.startsWith('BATMAN TECHNOLOGY, a ') &&
      introEn.includes('62272') &&
      introAr.includes('وهي شركة ذات مسؤولية محدودة') &&
      introAr.includes('62272'),
  );
}

// P no conflicting hardcoded company identity in legal docs
{
  const docsJoined = listLaunchLegalDocuments()
    .map((d) => d.markdownEn + '\n' + d.markdownAr)
    .join('\n');
  expect(
    'P corpus uses placeholders (no conflicting hardcoded BATMAN / battechno)',
    !docsJoined.includes('BATMAN TECHNOLOGY') &&
      !docsJoined.includes('info@battechno.com') &&
      !docsJoined.includes('شركة الرجل الوطواط للتكنولوجيا') &&
      docsJoined.includes(LEGAL_CONTENT_PLACEHOLDERS.LEGAL_ENTITY_NAME),
  );
  expect('P launch version is 1.0.1-launch-candidate', LAUNCH_CANDIDATE_VERSION === '1.0.1-launch-candidate');
}

// Architecture / contact separation files
{
  exists('packages/shared/src/legal-identity.ts', 'SSOT legal-identity.ts exists');
  has(
    'apps/web/src/components/admin/admin-legal-console-view.tsx',
    'admin-legal-readiness-entity',
    'Admin readiness shows LEGAL ENTITY checklist',
  );
  has(
    'packages/db/prisma/seed-legal-launch-candidate.ts',
    '1.0.1',
    'Seed targets 1.0.1 via LAUNCH_CANDIDATE_VERSION',
  );
  // fillPlaceholders leaves missing privacy token
  const filled = fillPlaceholders(
    `op ${LEGAL_CONTENT_PLACEHOLDERS.LEGAL_ENTITY_NAME} priv ${LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL}`,
    {
      LEGAL_ENTITY_NAME: 'BATMAN TECHNOLOGY',
    },
  );
  expect(
    'fillPlaceholders keeps privacy unresolved',
    filled.includes(LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL) &&
      filled.includes('BATMAN TECHNOLOGY') &&
      !filled.includes(LEGAL_CONTENT_PLACEHOLDERS.LEGAL_ENTITY_NAME),
  );
}

console.log(`\nPhase 3C.3 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
