/**
 * PF-2 — Early Partner funnel (About You + Partner Details) + lazy draft creation.
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-partner-funnel-early-steps.ts
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
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);
const onboardingSvc = read('apps/api/src/services/partner-onboarding.service.ts');
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

console.log('\n=== PF-2 Partner Funnel Early Steps ===\n');

console.log('— Structure / copy —');
{
  const aboutSlice = stepsUi.slice(
    stepsUi.indexOf('partner-step-entity-panel'),
    stepsUi.indexOf('partner-step-contact-panel'),
  );
  expect('1 About You panel exists', stepsUi.includes('partner-about-you'));
  expect('2 displayName reused', stepsUi.includes('owner-apply-displayName'));
  expect('3 Partner city reused', stepsUi.includes('owner-apply-city'));
  expect('4 farm count reused', stepsUi.includes('owner-apply-farmCount'));
  expect('5 no applicant capacity enum', !schema.includes('ApplicantCapacity') && !model.includes('applicantCapacity'));
  expect('6 no eligibility step', !stepsUi.includes("'eligibility'") && !model.includes("'eligibility'"));
  expect('7 entity type in Partner Details', stepsUi.includes('partner-partner-details') && stepsUi.includes('partner-entity-individual'));
  expect('8 entity type not in About You', !aboutSlice.includes('partner-entity-individual'));
  expect('9 location clarification present', stepsUi.includes('partner-location-clarification'));
  expect(
    '10 management alternate location removed from onboarding UI',
    !stepsUi.includes('partner-different-operating-location-toggle') &&
      !stepsUi.includes('partner-different-operating-location'),
  );
  expect(
    '10b business name only for business entity',
    stepsUi.includes("form.entityType === 'business'") && stepsUi.includes('owner-apply-businessName'),
  );
  expect('11 AR about label', ar.becomeOwner.steps.entity === 'عنك');
  expect('12 AR details label', ar.becomeOwner.steps.contact === 'بيانات الشريك');
  expect('13 EN about label', en.becomeOwner.steps.entity === 'About you');
  expect('14 EN details label', en.becomeOwner.steps.contact === 'Partner details');
  expect('15 no property pricing fields', !stepsUi.includes('basePrice') && !stepsUi.includes('amenityKeys'));
}

console.log('\n— Lazy creation / GET read-only —');
{
  expect('16 findOwnerOnboarding exists', onboardingSvc.includes('findOwnerOnboarding'));
  expect('17 emptyPartnerOnboardingView exists', onboardingSvc.includes('emptyPartnerOnboardingView'));
  expect('18 started:false on empty view', onboardingSvc.includes('started: false'));
  expect(
    '19 GET uses find not ensure',
    /export async function getPartnerOnboarding[\s\S]{0,200}findOwnerOnboarding/.test(onboardingSvc),
  );
  expect(
    '20 requirements GET uses find',
    /export async function getPartnerRequirements[\s\S]{0,200}findOwnerOnboarding/.test(onboardingSvc),
  );
  expect(
    '21 agreement GET no ensure',
    !/export async function getPartnerAgreement[\s\S]{0,120}ensureOwnerOnboarding/.test(onboardingSvc),
  );
  expect('22 first save meaningful gate', onboardingSvc.includes('ONBOARDING_NOT_STARTED'));
  expect('23 concurrent first-save handling', onboardingSvc.includes('Concurrent first-save'));
  expect('24 ensure still for mutations', onboardingSvc.includes('ensureOwnerOnboarding'));
  expect('25 domain-derived resume', model.includes('derivePartnerResumeStep'));
  expect('26 About You aliases', model.includes("about: 'entity'"));
  expect('27 Partner Details aliases', model.includes("details: 'contact'"));
  expect('26b no Start→ensure', !view.includes('ensureOwnerOnboarding'));
}

console.log('\n— Unchanged surfaces —');
{
  expect('28 four wizard steps', /'entity',\s*'contact',\s*'documents',\s*'review'/.test(model));
  expect('29 documents panel present', stepsUi.includes('partner-step-documents-panel'));
  expect('30 no Partner payout panel', !stepsUi.includes('partner-step-payout-panel'));
  expect('31 agreement in Review (not standalone step)', stepsUi.includes('partner-review-section-agreement') && !stepsUi.includes("currentStep === 'agreement'"));
  expect(
    '32 Partner submit without payout gate',
    !/canSubmit\s*=\s*[\s\S]*?payoutProfileComplete\s*&&/.test(onboardingSvc),
  );
  expect('33 private R2 storage', onboardingSvc.includes('private-storage'));
  expect('34 Add Farm handoff', addFarm.includes("'/owner/properties/new'"));
  expect('35 PF-1 landing intact', landing.includes('partner-acquisition-hero'));
  expect('36 no PartnerApplication model', !schema.includes('model PartnerApplication'));
  expect('37 no PF-2 migration', !migrations.some((m) => /pf-?2|lazy.?draft|early.?step/i.test(m)));
  expect('38 no new env keys', !envExample.includes('PARTNER_FUNNEL') && !envExample.includes('LAZY_DRAFT'));
  expect('39 role not set by landing', !landing.includes("role: 'owner'"));
  expect('40 onboarding GET route', ownerRoutes.includes("'/onboarding'"));
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

async function createCustomer() {
  const email = `ua6a.pf2.early.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'Pf2EarlyPass!2026';
  const create = await apiJson('/internal/qa/users/create-password', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      name: 'PF2 Early',
      attachPasswordIdentity: true,
    }),
  });
  if (!create.res.ok) throw new Error(`create user failed: ${create.res.status} ${JSON.stringify(create.body)}`);
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
  return { email, cookie, userId: create.body?.data?.id as string };
}

async function cleanupUser(email: string) {
  try {
    await apiJson('/internal/qa/users/cleanup', {
      method: 'POST',
      body: JSON.stringify({ emails: [email] }),
    });
  } catch {
    /* best effort */
  }
}

console.log('\n— Live API (if available) —');
try {
  const health = await fetch(API.replace(/\/api\/v1$/, '') + '/health').catch(() => null);
  const healthAlt = health?.ok
    ? health
    : await fetch(API.replace(/\/api\/v1$/, '') + '/api/v1/health').catch(() => null);
  if (!healthAlt?.ok) {
    console.log('  ⏭ API not reachable — skipping live checks');
  } else {
  let customer: { email: string; cookie: string } | null = null;
  try {
    customer = await createCustomer();
  } catch (e) {
    console.log(
      `  ⏭ Live QA users unavailable — skipping (${e instanceof Error ? e.message.slice(0, 80) : String(e)})`,
    );
  }
  if (customer) {
  const { email, cookie } = customer;
  try {
    for (let i = 0; i < 3; i++) {
      const g = await apiJson('/owner/onboarding', { cookie });
      expect(`41 GET #${i + 1} ok`, g.res.ok);
      expect(`42 GET #${i + 1} started false`, g.body?.data?.started === false);
      expect(`43 GET #${i + 1} no profile id`, g.body?.data?.ownerProfileId == null);
    }

    const reqs = await apiJson('/owner/onboarding/requirements', { cookie });
    expect('44 requirements GET without draft', reqs.res.ok);

    const weak = await apiJson('/owner/onboarding', {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({ displayName: 'A' }),
    });
    expect('45 weak first save rejected', weak.res.status === 400);

    const save = await apiJson('/owner/onboarding', {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({
        displayName: 'أحمد الشريك',
        city: 'عمان',
        area: 'خلدا',
        approximateFarmCount: 1,
      }),
    });
    expect('46 first About You save ok', save.res.ok, JSON.stringify(save.body));
    expect('47 started true after save', save.body?.data?.started === true);
    expect('48 status draft', save.body?.data?.verificationStatus === 'draft');
    expect('49 displayName saved', save.body?.data?.displayName === 'أحمد الشريك');
    const profileId = save.body?.data?.ownerProfileId as string;
    expect('50 ownerProfileId assigned', Boolean(profileId));

    const me = await apiJson('/auth/me', { cookie });
    expect('51 role remains customer', me.body?.data?.user?.role === 'customer');

    const g2 = await apiJson('/owner/onboarding', { cookie });
    expect('52 GET after save started true', g2.body?.data?.started === true);
    expect('53 GET same profile id', g2.body?.data?.ownerProfileId === profileId);

    const u2 = await createCustomer();
    try {
      const payload = {
        displayName: 'Concurrent Partner',
        city: 'Irbid',
        area: 'University',
        approximateFarmCount: 2,
      };
      const [a, b] = await Promise.all([
        apiJson('/owner/onboarding', {
          method: 'PATCH',
          cookie: u2.cookie,
          body: JSON.stringify(payload),
        }),
        apiJson('/owner/onboarding', {
          method: 'PATCH',
          cookie: u2.cookie,
          body: JSON.stringify(payload),
        }),
      ]);
      expect('54 concurrent at least one ok', a.res.ok || b.res.ok);
      expect('55 concurrent no 500', a.res.status !== 500 && b.res.status !== 500);
      const ids = [a.body?.data?.ownerProfileId, b.body?.data?.ownerProfileId].filter(Boolean);
      expect('56 concurrent same profile id', ids.length >= 1 && new Set(ids).size === 1);
    } finally {
      await cleanupUser(u2.email);
    }
  } finally {
    await cleanupUser(email);
  }
  }
  }
} catch (err) {
  fail('live API suite', err instanceof Error ? err.message : String(err));
}

console.log(`\nPF-2 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
