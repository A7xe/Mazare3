/**
 * PF-1 — Partner landing + Unified Auth handoff.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-funnel-entry.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authEntryHref, sanitizeReturnUrl } from '../src/safe-return-url.ts';

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

const page = read('apps/web/src/app/[locale]/become-owner/page.tsx');
const view = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);
const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const stepsUi = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const onboardingSvc = read('apps/api/src/services/partner-onboarding.service.ts');
const addFarm = read('apps/web/src/lib/add-farm-entry.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const envExample = read('.env.example');
const migrations = readdirSync(join(root, 'packages/db/prisma/migrations'));

console.log('\n=== PF-1 Partner Funnel Entry ===\n');

console.log('— Route / landing —');
{
  expect('1 canonical become-owner page', page.includes('BecomeOwnerView'));
  expect('2 partner-entry-landing', landing.includes('partner-entry-landing'));
  expect('3 acquisition hero', landing.includes('partner-acquisition-hero'));
  expect('4 guest Start CTA', landing.includes('partner-start-application'));
  expect('5 guest Resume CTA', landing.includes('partner-resume-application'));
  expect('6 old auth bridge removed', !landing.includes('partner-auth-bridge'));
  expect('7 no partner-start-signup', !landing.includes('partner-start-signup'));
  expect('8 no partner-start-login', !landing.includes('partner-start-login'));
}

console.log('\n— Unified Auth handoff —');
{
  expect('9 sanitizeReturnUrl used for handoff', landing.includes('sanitizeReturnUrl'));
  expect('10 no forced emailMode=signup', !landing.includes('emailMode=signup'));
  expect('11 no forced mode=email', !/mode=email/.test(landing));
  expect('12 handoff builds /auth?returnUrl=', landing.includes('/auth?returnUrl='));
  const href = authEntryHref({ returnUrl: '/become-owner' });
  expect('13 authEntryHref still available for QA', href.startsWith('/auth?'));
  expect('14 returnUrl preserved safely', href.includes('returnUrl='));
  expect('15 no mode forced in authEntryHref', !href.includes('mode='));
  expect('16 no emailMode forced in authEntryHref', !href.includes('emailMode='));
  expect('16 unsafe return rejected', sanitizeReturnUrl('https://evil.example') === null);
  expect('17 /become-owner return accepted', sanitizeReturnUrl('/become-owner') === '/become-owner');
  expect('18 no Phone/Google buttons on Partner landing', !landing.includes('auth-continue-google') && !landing.includes('startPhoneOtp'));
}

console.log('\n— Copy —');
{
  expect('19 AR eyebrow', ar.becomeOwner.entry.eyebrow === 'انضم كشريك');
  expect('20 AR headline', ar.becomeOwner.entry.headline === 'انضم كشريك في مزارع');
  expect('21 AR start CTA', ar.becomeOwner.entry.startCta === 'ابدأ طلب الانضمام');
  expect('22 AR resume CTA', ar.becomeOwner.entry.resumeCta === 'لدي طلب سابق — متابعة الطلب');
  expect('23 EN start CTA', en.becomeOwner.entry.startCta === 'Start your application');
  expect('24 EN resume CTA', Boolean(en.becomeOwner.entry.resumeCta));
  const entryBlob = JSON.stringify(ar.becomeOwner.entry) + JSON.stringify(en.becomeOwner.entry);
  expect('25 no fake thousands claim', !/آلاف|thousands of bookings/i.test(entryBlob));
  expect('26 no guaranteed income claim', !/دخل مضمون|guaranteed (income|earnings|demand)/i.test(entryBlob));
  expect('27 no commission-free claim', !/بدون عمولة|zero commission/i.test(entryBlob));
}

console.log('\n— Authenticated state routing (preserved) —');
{
  expect('28 guest uses landing', view.includes('mode="guest"'));
  expect('29 authenticated start mode', view.includes('mode="start"'));
  expect('30 continue for meaningful draft', view.includes('partner-continue-application'));
  expect('31 hasMeaningfulPartnerProgress', model.includes('hasMeaningfulPartnerProgress'));
  expect('32 pending statuses', model.includes('PENDING_PARTNER_STATUSES'));
  expect('33 approved statuses', model.includes('APPROVED_PARTNER_STATUSES'));
  expect('34 changes_requested editable', model.includes("'changes_requested'"));
  expect('35 PartnerStatusPanel used', view.includes('PartnerStatusPanel'));
  expect('36 approved owner Add Farm', addFarm.includes("'/owner/properties/new'"));
  expect('37 isApprovedOwnerForAddFarm', addFarm.includes('isApprovedOwnerForAddFarm'));
}

console.log('\n— Wizard / KYC / payout (PF-5) —');
{
  expect(
    '38 four wizard steps (PF-5; payout post-approval)',
    /entity',\s*'contact',\s*'documents',\s*'review'/.test(model) &&
      !/'payout',\s*'review'/.test(model.match(/PARTNER_ONBOARDING_STEPS = \[[\s\S]*?\] as const/)?.[0] ?? ''),
  );
  expect('39 documents step UI present', stepsUi.includes('partner-step-documents-panel'));
  expect(
    '40 payout setup route exists post-approval',
    existsSync(join(root, 'apps/web/src/app/[locale]/owner/payout/page.tsx')),
  );
  expect(
    '41 Partner submit no longer gates on payoutProfileComplete',
    !/canSubmit\s*=\s*[\s\S]*?payoutProfileComplete\s*&&/.test(onboardingSvc),
  );
  expect('42 ensureOwnerOnboarding still exists', onboardingSvc.includes('ensureOwnerOnboarding'));
  expect('43 no Partner Phone OTP in landing', !landing.includes('phone/start'));
}

console.log('\n— Safety —');
{
  expect('44 no PF-1 migration folder', !migrations.some((m) => /pf-?1|partner.funnel.entry/i.test(m)));
  expect('45 no new Google env keys required', !envExample.includes('PARTNER_FUNNEL'));
  expect('46 role not set by landing', !landing.includes("role: 'owner'") && !landing.includes('role=owner'));
  expect('47 Partner approval != property approval note in how', /approval|موافقة/i.test(String(en.becomeOwner.entry.howSubtitle + ar.becomeOwner.entry.howSubtitle)));
  expect('48 mobile CTA classes present', landing.includes('min-h-12') || landing.includes('h-12'));
  expect('49 schema PartnerApplication not introduced', !read('packages/db/prisma/schema.prisma').includes('model PartnerApplication'));
  expect('50 page file exists', existsSync(join(root, 'apps/web/src/app/[locale]/become-owner/page.tsx')));
}

console.log(`\nPF-1 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
