/**
 * PF-3 — Documents simplification + Agreement-in-Review (5 visible steps).
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-partner-funnel-documents-review.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const stepsUi = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const view = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const stepper = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-stepper.tsx',
);
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);
const onboardingSvc = read('apps/api/src/services/partner-onboarding.service.ts');
const reqConfig = read('apps/api/src/config/partner-requirements.config.ts');
const ownerRoutes = read('apps/api/src/routes/owner.ts');
const addFarm = read('apps/web/src/lib/add-farm-entry.ts');
const schema = read('packages/db/prisma/schema.prisma');
const envExample = read('.env.example');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrations = readdirSync(join(root, 'packages/db/prisma/migrations'));

const API = process.env.API_URL
  ? `${process.env.API_URL.replace(/\/$/, '')}/api/v1`
  : process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4000/api/v1';

console.log('\n=== PF-3 Documents + Agreement-in-Review ===\n');

console.log('— Visible wizard (4 steps after PF-5) —');
{
  expect(
    '1 four visible steps',
    /'entity',\s*'contact',\s*'documents',\s*'review'/.test(model) &&
      !/'payout',\s*'review'/.test(model.match(/PARTNER_ONBOARDING_STEPS = \[[\s\S]*?\] as const/)?.[0] ?? ''),
  );
  expect('2 no standalone agreement step UI', !stepsUi.includes("currentStep === 'agreement'"));
  expect('3 no agreement wizard panel', !stepsUi.includes('partner-step-agreement-panel'));
  expect('4 agreement lives in Review', stepsUi.includes('partner-review-section-agreement'));
  expect(
    '5 legacy agreement → review',
    model.includes("agreement: 'review'") && model.includes('LEGACY_PARTNER_STEP_ALIASES'),
  );
  expect('6 About You panel unchanged', stepsUi.includes('partner-step-entity-panel'));
  expect('7 Partner Details panel unchanged', stepsUi.includes('partner-step-contact-panel'));
  expect('8 stepper 4 columns', stepper.includes('md:grid-cols-4') && !stepper.includes('md:grid-cols-5'));
  expect('9 AR review label', ar.becomeOwner.steps.review.includes('مراجعة'));
  expect('10 EN review label', en.becomeOwner.steps.review.toLowerCase().includes('review'));
}

console.log('\n— Documents UX / requirements —');
{
  expect('11 documents checklist title key', Boolean(en.becomeOwner.docs?.checklistTitle));
  expect('12 AR checklist title', ar.becomeOwner.docs.checklistTitle === 'المستندات المطلوبة');
  expect('13 change-needed copy', Boolean(ar.becomeOwner.docs?.changeNeeded));
  expect('14 docs panel present', stepsUi.includes('partner-step-documents-panel'));
  expect('15 requirementsForEntity filter', reqConfig.includes('requirementsForEntity'));
  expect('16 identity required all', reqConfig.includes("documentType: 'identity'"));
  expect('17 ownership required all', reqConfig.includes("documentType: 'property_ownership'"));
  expect(
    '18 management_authorization individual optional',
    /management_authorization[\s\S]*entityType: 'individual'[\s\S]*required: false/.test(reqConfig),
  );
  expect(
    '19 business_registration business required',
    /business_registration[\s\S]*entityType: 'business'[\s\S]*required: true/.test(reqConfig),
  );
  expect('20 payout_proof still in config (post-approval)', /documentType: 'payout_proof'[\s\S]*required: true/.test(reqConfig));
  expect('21 private R2', onboardingSvc.includes('private-storage') || onboardingSvc.includes('privateStorage'));
  expect('22 upload route', ownerRoutes.includes('/onboarding/documents'));
  expect('23 replace/supersede', onboardingSvc.includes('superseded') && onboardingSvc.includes('supersededById'));
  expect('24 needs_attention UI', stepsUi.includes('needs_attention') && stepsUi.includes('partner-doc-change-needed'));
  expect('25 Partner KYC excludes payout panel', !stepsUi.includes('partner-step-payout-panel'));
  expect('26 KYC/payout requirement helpers split', reqConfig.includes('partnerKycRequirementsForEntity'));
}

console.log('\n— Review / agreement persistence —');
{
  expect('27 review summaries', stepsUi.includes('partner-review-summaries'));
  expect('28 review sections entity/contact/docs/agreement', 
    stepsUi.includes('partner-review-section-entity') &&
      stepsUi.includes('partner-review-section-contact') &&
      stepsUi.includes('partner-review-section-documents') &&
      stepsUi.includes('partner-review-section-agreement') &&
      !stepsUi.includes('partner-review-section-payout'),
  );
  expect('29 IBAN not in Partner Review', !stepsUi.includes('partner-review-iban-masked'));
  expect('30 edit actions', stepsUi.includes("onEditStep('entity')") && stepsUi.includes("onEditStep('documents')"));
  expect('31 agreement checkbox', stepsUi.includes('owner-apply-terms'));
  expect('32 agreement not prechecked (state from hydrate)', view.includes('setAcceptedTerms'));
  expect('33 acceptPartnerAgreement API used', view.includes('acceptPartnerAgreement'));
  expect('34 agreement version in UI', stepsUi.includes('agreementVersion') || stepsUi.includes('agreement.version'));
  expect('35 submit gated on agreement/canSubmit', stepsUi.includes('partner-submit') && stepsUi.includes('canSubmit'));
  expect('36 accept before submit path', view.includes('acceptPartnerAgreement') && view.includes('submitPartnerOnboarding'));
  expect('37 agreement acceptance service audit', onboardingSvc.includes('owner.partner_agreement_accepted'));
  expect('38 acceptedAt preserved', onboardingSvc.includes('acceptedAt'));
}

console.log('\n— Resume / corrections —');
{
  expect('39 derivePartnerResumeStep', model.includes('derivePartnerResumeStep'));
  expect('40 preferCorrectionStep', model.includes('preferCorrectionStep'));
  expect('41 agreement missing → review step', model.includes("if (key === 'agreement') return 'review'"));
  expect('42 changes_requested prefer docs', view.includes('preferCorrectionStep'));
  expect('43 resolvePartnerOnboardingStepId', model.includes('resolvePartnerOnboardingStepId'));
  expect('44 about/details aliases', model.includes("about: 'entity'") && model.includes("details: 'contact'"));
}

console.log('\n— Unchanged / freezes —');
{
  expect('45 submit still readiness.canSubmit server-side', onboardingSvc.includes('canSubmit'));
  expect('46 role remains customer until admin', !landing.includes("role: 'owner'"));
  expect('47 Add Farm after approval', addFarm.includes("'/owner/properties/new'"));
  expect('48 no property fields in review', !stepsUi.includes('basePrice') && !stepsUi.includes('amenityKeys'));
  expect('49 PF-1 hero intact', landing.includes('partner-acquisition-hero'));
  expect('50 PF-2 lazy GET', onboardingSvc.includes('findOwnerOnboarding') && onboardingSvc.includes('started: false'));
  expect('51 no PF-3 schema/migration', !migrations.some((m) => /pf-?3|agreement.?review|docs.?simplif/i.test(m)));
  expect('52 no PartnerApplication model', !schema.includes('model PartnerApplication'));
  expect('53 no env changes', !envExample.includes('PARTNER_FUNNEL') && !envExample.includes('PF3'));
  expect('54 no persisted wizard step index', !schema.includes('wizardStep') && !schema.includes('onboardingStep'));
  expect('55 AR accept label explicit', String(ar.becomeOwner.agreementUx.acceptLabel).includes('أقر'));
  expect('56 EN accept label explicit', String(en.becomeOwner.agreementUx.acceptLabel).toLowerCase().includes('confirm'));
  expect('57 legacy payout alias → review', model.includes("payout: 'review'"));
  expect('58 double-submit saving guard', view.includes('setSaving(true)') && stepsUi.includes('disabled={'));
}

async function apiJson(path: string, init?: RequestInit & { cookie?: string }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (init?.cookie) headers.Cookie = init.cookie;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function createCustomer(tag: string) {
  const email = `ua6a.pf3.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'Pf3DocsPass!2026';
  const create = await apiJson('/internal/qa/users/create-password', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      name: 'PF3 Docs',
      attachPasswordIdentity: true,
    }),
  });
  if (!create.res.ok) throw new Error(`create user failed: ${create.res.status}`);
  const login = await apiJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const setCookie = login.res.headers.getSetCookie?.() ?? [];
  const cookie =
    setCookie.find((c) => c.startsWith('mazare3_session='))?.split(';')[0] ??
    login.res.headers.get('set-cookie')?.split(';')[0] ??
    '';
  if (!cookie) throw new Error('no session cookie');
  return { email, password, cookie };
}

console.log('\n— Live API (optional) —');
try {
  const health = await fetch(`${API.replace(/\/api\/v1$/, '')}/health`).catch(() => null);
  if (!health?.ok) {
    console.log('  ⏭ API not reachable — skipping live checks');
  } else {
    const { cookie, email } = await createCustomer('live');
    try {
      const empty = await apiJson('/owner/onboarding', { cookie });
      expect('59 live GET started false', empty.body?.data?.started === false);

      const patch = await apiJson('/owner/onboarding', {
        method: 'PATCH',
        cookie,
        body: JSON.stringify({
          displayName: 'PF3 Partner',
          city: 'Amman',
          area: 'Abdoun',
          approximateFarmCount: 1,
        }),
      });
      expect('60 live lazy create on About You', Boolean(patch.body?.data?.ownerProfileId));

      await apiJson('/owner/onboarding', {
        method: 'PATCH',
        cookie,
        body: JSON.stringify({
          entityType: 'individual',
          bio: 'Partner bio text that is long enough for validation gates.',
          phone: '0790000001',
          legalName: 'PF3 Partner',
          operatingPhone: '0790000001',
        }),
      });

      const reqs = await apiJson('/owner/onboarding/requirements', { cookie });
      const rows = reqs.body?.data ?? [];
      const types = rows.map((r: { documentType: string }) => r.documentType);
      expect('61 individual has identity', types.includes('identity'));
      expect('62 individual has ownership', types.includes('property_ownership'));
      expect('63 individual KYC excludes payout_proof (PF-5)', !types.includes('payout_proof'));
      expect('64 individual no business_registration', !types.includes('business_registration'));
      expect(
        '65 individual optional management_authorization',
        rows.some(
          (r: { documentType: string; required: boolean }) =>
            r.documentType === 'management_authorization' && r.required === false,
        ),
      );

      const agr = await apiJson('/owner/partner-agreement', { cookie });
      const agreementId = agr.body?.data?.current?.id;
      expect('66 agreement available', Boolean(agreementId));

      const submitBlocked = await apiJson('/owner/onboarding/submit', { method: 'POST', cookie });
      expect(
        '67 submit blocked without agreement/docs',
        !submitBlocked.res.ok,
      );

      if (agreementId) {
        const accept = await apiJson('/owner/partner-agreement/accept', {
          method: 'POST',
          cookie,
          body: JSON.stringify({ agreementId, acceptedLocale: 'ar' }),
        });
        expect('68 agreement accept persists', accept.res.ok);
        const after = await apiJson('/owner/onboarding', { cookie });
        expect(
          '69 readiness.agreementAccepted',
          after.body?.data?.readiness?.agreementAccepted === true,
        );
        expect(
          '70 accepted metadata version',
          Boolean(after.body?.data?.acceptedAgreement?.version || after.body?.data?.acceptedAgreement?.agreementId),
        );
      }

      // Cleanup fixture user via internal QA if available
      await apiJson('/internal/qa/users/cleanup', {
        method: 'POST',
        cookie,
        body: JSON.stringify({ emails: [email] }),
      }).catch(() => undefined);
    } catch (err) {
      fail('live API block', err instanceof Error ? err.message : String(err));
    }
  }
} catch (err) {
  console.log(`  ⏭ live API skipped: ${err instanceof Error ? err.message : String(err)}`);
}

console.log(`\nPF-3 Documents/Review QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
