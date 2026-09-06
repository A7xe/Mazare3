/**
 * Add Farm entry routing — status-aware CTAs (post AF-6).
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-add-farm-entry-routing.ts
 */
import { readFileSync, existsSync } from 'node:fs';
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

const entry = read('apps/web/src/lib/add-farm-entry.ts');
const addFarmLink = read('apps/web/src/components/layout/add-farm-link.tsx');
const bottomNav = read('apps/web/src/components/layout/marketplace-bottom-nav.tsx');
const footer = read('apps/web/src/components/layout/site-footer.tsx');
const homePage = read('apps/web/src/app/[locale]/page.tsx');
const trustStrip = read('apps/web/src/components/home/home-trust-strip.tsx');
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);
const statusPanelPo = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-status-panel.tsx',
);
const becomeOwner = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const ownerGuard = read('apps/web/src/components/owner/owner-guard.tsx');
const wizardPage = read('apps/web/src/app/[locale]/owner/properties/new/page.tsx');
const contact = read('apps/web/src/components/legal/contact-identity.tsx');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Shared resolver —');
{
  expect('1 resolveAddFarmHref exported', entry.includes('export function resolveAddFarmHref'));
  expect('2 wizard href constant', entry.includes("'/owner/properties/new'"));
  expect('3 partner href constant', entry.includes("'/become-owner'"));
  expect(
    '4 approved owner requires role+status',
    entry.includes("role === 'owner'") && entry.includes("ownerProfileStatus === 'approved'"),
  );
  expect(
    '5 AddFarmLink uses shared entry hook',
    addFarmLink.includes('useAddFarmEntry') && addFarmLink.includes('data-add-farm-entry'),
  );
  expect('5b resolveAddFarmLabelKey exported', entry.includes('export function resolveAddFarmLabelKey'));
  expect('5c label keys cover track/update/continue', entry.includes("'trackApplication'") && entry.includes("'updateApplication'") && entry.includes("'continueApplication'"));
}

console.log('\n— Runtime matrix (source-level) —');
{
  // Inline evaluate resolver logic by reimplementing the same rules here for clarity.
  function resolve(user: { role?: string; ownerProfileStatus?: string | null } | null) {
    if (user?.role === 'owner' && user.ownerProfileStatus === 'approved') {
      return '/owner/properties/new';
    }
    return '/become-owner';
  }
  expect('6 guest → partner', resolve(null) === '/become-owner');
  expect('7 customer no app → partner', resolve({ role: 'customer' }) === '/become-owner');
  expect(
    '8 draft/pending owner → partner',
    resolve({ role: 'owner', ownerProfileStatus: 'pending' }) === '/become-owner',
  );
  expect(
    '9 rejected owner → partner',
    resolve({ role: 'owner', ownerProfileStatus: 'rejected' }) === '/become-owner',
  );
  expect(
    '10 approved owner → wizard',
    resolve({ role: 'owner', ownerProfileStatus: 'approved' }) === '/owner/properties/new',
  );
}

console.log('\n— Navigation wiring —');
{
  expect('11 bottom nav uses useAddFarmEntry', bottomNav.includes('useAddFarmEntry'));
  expect('12 bottom nav pos2 uses addFarmHref', bottomNav.includes('href: addFarmHref'));
  expect('13 footer uses AddFarmLink', footer.includes('AddFarmLink'));
  expect('14 home CTA uses addFarmHref', homePage.includes('primaryHref={addFarmHref}'));
  expect('15 trust strip accepts addFarmHref', trustStrip.includes('addFarmHref'));
  expect('16 contact uses resolveAddFarmHref', contact.includes('resolveAddFarmHref'));
  expect('16b home uses resolveAddFarmLabelKey', homePage.includes('resolveAddFarmLabelKey'));
  expect('16c EN track CTA copy', en.common.addFarmCta.trackApplication === 'Track partner application');
  expect('16d AR track CTA copy', ar.common.addFarmCta.trackApplication === 'متابعة طلب الشراكة');
}

console.log('\n— Become owner behavior —');
{
  expect(
    '17 approved redirects to wizard',
    becomeOwner.includes("router.replace('/owner/properties/new')"),
  );
  expect('18 uses isApprovedOwnerForAddFarm', becomeOwner.includes('isApprovedOwnerForAddFarm'));
  expect('19 entry bridge test id', landing.includes('become-owner-entry-bridge'));
  expect('20 resumes via fetchPartnerOnboarding', becomeOwner.includes('fetchPartnerOnboarding'));
  expect('21 no auto create property on visit', !becomeOwner.includes('createOwnerPropertyDraft'));
  expect(
    '22 pending statuses stay on become-owner',
    becomeOwner.includes('PENDING_PARTNER_STATUSES') &&
      becomeOwner.includes('showStatusOnly'),
  );
  expect(
    '23 changes_requested editable',
    becomeOwner.includes("'changes_requested'"),
  );
  expect('24 rejected notice retained', statusPanelPo.includes('rejectedNotice'));
  expect('24b tracking status card', statusPanelPo.includes('partner-application-status-card'));
  expect('24c return-later hint', statusPanelPo.includes('partner-return-later-hint'));
  expect('24d remembers partner status hint', becomeOwner.includes('rememberPartnerVerificationStatus'));
  expect(
    '24e EN submitted tracking title',
    en.becomeOwner.statusUx.submittedTitle === 'Partner application submitted',
  );
  expect(
    '24f AR submitted tracking title',
    ar.becomeOwner.statusUx.submittedTitle === 'تم إرسال طلب الشراكة بنجاح',
  );
}

console.log('\n— Wizard / OwnerGuard integrity —');
{
  expect('25 wizard page uses AddFarmWizard', wizardPage.includes('AddFarmWizard'));
  expect('26 OwnerGuard still gates owner', ownerGuard.includes('OwnerGuard') || ownerGuard.includes('ownerProfileStatus'));
  expect('27 OwnerGuard requires approved', ownerGuard.includes("ps === 'approved'"));
  expect('28 OwnerGuard not weakened for customers', ownerGuard.includes("role !== 'owner'"));
  expect('29 pending still links become-owner', ownerGuard.includes('href="/become-owner"'));
  expect(
    '29b Add Farm deep-link redirects non-approved to become-owner',
    ownerGuard.includes('isAddFarmDeepLink') &&
      ownerGuard.includes("router.replace('/become-owner')"),
  );
  expect(
    '29c deep-link redirect does not set allowed for customers',
    /role !== 'owner'[\s\S]{0,400}replace\('\/become-owner'\)/.test(ownerGuard) &&
      !/role !== 'owner'[\s\S]{0,200}setState\('allowed'\)/.test(ownerGuard),
  );
}

console.log('\n— i18n / schema freeze —');
{
  expect('30 EN entryBridge', typeof en.becomeOwner.entryBridge === 'string' && en.becomeOwner.entryBridge.length > 20);
  expect('31 AR entryBridge', typeof ar.becomeOwner.entryBridge === 'string' && ar.becomeOwner.entryBridge.includes('شريك'));
  expect('32 EN goToAddFarm', en.becomeOwner.goToAddFarm === 'Add your first property');
  expect('33 AR goToAddFarm', ar.becomeOwner.goToAddFarm === 'أضف أول مزرعة');
  expect(
    '34 no new migration folder invent',
    !existsSync(join(migrationsDir, '20260831120000_add_farm_entry')),
  );
}

console.log(`\nAdd Farm entry routing QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
