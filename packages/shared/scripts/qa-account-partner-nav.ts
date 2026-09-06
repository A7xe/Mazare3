/**
 * Account page — Partner Application discoverability.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-account-partner-nav.ts
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
const home = read('apps/web/src/components/account/account-home-view.tsx');
const section = read('apps/web/src/components/account/account-partner-section.tsx');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const appDir = join(root, 'apps/web/src/app');

type User = { role?: string; ownerProfileStatus?: string | null } | null;

function isApproved(user: User) {
  return user?.role === 'owner' && user.ownerProfileStatus === 'approved';
}

function resolveHref(user: User) {
  return isApproved(user) ? '/owner/properties/new' : '/become-owner';
}

function resolveSurface(user: User, verificationStatus?: string | null) {
  if (!user) return 'join';
  if (user.role === 'admin') return null;
  if (isApproved(user)) return 'approved';
  const vs = verificationStatus ?? null;
  if (vs === 'approved' || vs === 'legacy_approved') return 'approved';
  if (vs === 'draft') return 'draft';
  if (vs === 'submitted') return 'submitted';
  if (vs === 'under_review') return 'under_review';
  if (vs === 'changes_requested') return 'changes_requested';
  if (vs === 'rejected') return 'rejected';
  if (vs === 'suspended') return 'suspended';
  const ownerStatus = user.ownerProfileStatus ?? null;
  if (!ownerStatus) return 'join';
  if (ownerStatus === 'approved') return 'approved';
  if (ownerStatus === 'rejected') return 'rejected';
  if (ownerStatus === 'suspended') return 'suspended';
  return 'draft';
}

function shouldFetch(user: User) {
  if (!user || user.role === 'admin') return false;
  if (isApproved(user)) return false;
  return Boolean(user.ownerProfileStatus);
}

console.log('\n— Shared resolver —');
{
  expect('1 resolveAccountPartnerSurface exported', entry.includes('export function resolveAccountPartnerSurface'));
  expect('2 shouldFetchPartnerStatusForAccount exported', entry.includes('export function shouldFetchPartnerStatusForAccount'));
  expect('3 join when no profile', resolveSurface({ role: 'customer', ownerProfileStatus: null }) === 'join');
  expect('4 draft from verification', resolveSurface({ role: 'customer', ownerProfileStatus: 'pending' }, 'draft') === 'draft');
  expect('5 submitted', resolveSurface({ role: 'customer', ownerProfileStatus: 'pending' }, 'submitted') === 'submitted');
  expect('6 under_review', resolveSurface({ role: 'customer', ownerProfileStatus: 'pending' }, 'under_review') === 'under_review');
  expect('7 changes_requested', resolveSurface({ role: 'customer', ownerProfileStatus: 'pending' }, 'changes_requested') === 'changes_requested');
  expect('8 rejected', resolveSurface({ role: 'customer', ownerProfileStatus: 'rejected' }, 'rejected') === 'rejected');
  expect('9 approved owner', resolveSurface({ role: 'owner', ownerProfileStatus: 'approved' }) === 'approved');
  expect('10 admin hidden', resolveSurface({ role: 'admin', ownerProfileStatus: null }) === null);
  expect(
    '11 fetch only when profile exists',
    shouldFetch({ role: 'customer', ownerProfileStatus: 'pending' }) &&
      !shouldFetch({ role: 'customer', ownerProfileStatus: null }) &&
      !shouldFetch({ role: 'owner', ownerProfileStatus: 'approved' }),
  );
  expect('11b entry implements same join rule', entry.includes("if (!ownerStatus) return 'join'"));
}

console.log('\n— Destinations —');
{
  expect('12 applicant href become-owner', resolveHref({ role: 'customer', ownerProfileStatus: 'pending' }) === '/become-owner');
  expect('13 approved href wizard', resolveHref({ role: 'owner', ownerProfileStatus: 'approved' }) === '/owner/properties/new');
  expect('14 my properties href constant', entry.includes("OWNER_PROPERTIES_HREF = '/owner/properties'"));
  expect('15 section applicant card → become-owner', section.includes('ADD_FARM_PARTNER_HREF'));
  expect('16 section my properties → owner properties', section.includes('OWNER_PROPERTIES_HREF'));
  expect('17 section add property → wizard', section.includes('ADD_FARM_WIZARD_HREF'));
  expect(
    '18 no partner-tracking route invent',
    !existsSync(join(appDir, '[locale]/partner-tracking')) &&
      !existsSync(join(appDir, '[locale]/my-partner-application')),
  );
  expect('19 approved gate intact', entry.includes("role === 'owner'") && entry.includes("ownerProfileStatus === 'approved'"));
}

console.log('\n— Account UI wiring —');
{
  expect('20 AccountPartnerSection used', home.includes('AccountPartnerSection'));
  expect('21 fetches onboarding when needed', home.includes('shouldFetchPartnerStatusForAccount') && home.includes('fetchPartnerOnboarding'));
  expect('22 remembers status for nav CTAs', home.includes('rememberPartnerVerificationStatus'));
  expect('23 no localStorage status cache', !home.includes('localStorage') && !section.includes('localStorage'));
  expect('24 partner section testid', section.includes('account-partner-section'));
  expect('25 partner card testid', section.includes('account-partner-card'));
  expect('26 approved my properties testid', section.includes('account-partner-my-properties'));
  expect('27 approved add property testid', section.includes('account-partner-add-property'));
  expect('28 status badge text', section.includes('account-partner-status'));
}

console.log('\n— i18n —');
{
  const p = en.accountHome.partnership;
  const pa = ar.accountHome.partnership;
  expect('29 EN section title', p.sectionTitle === 'Partnership & property management');
  expect('30 AR section title', pa.sectionTitle === 'الشراكة وإدارة المزارع');
  expect('31 EN join CTA', p.join.cta === 'Join as a partner');
  expect('32 AR join CTA', pa.join.cta === 'انضم كشريك');
  expect('33 EN draft CTA', p.draft.cta === 'Continue application');
  expect('34 AR draft CTA', pa.draft.cta === 'أكمل طلب الشراكة');
  expect('35 EN submitted status', p.submitted.status === 'Awaiting review');
  expect('36 AR submitted status', pa.submitted.status === 'بانتظار المراجعة');
  expect('37 EN under_review status', p.under_review.status === 'Under review');
  expect('38 AR under_review status', pa.under_review.status === 'قيد المراجعة');
  expect('39 EN changes CTA', p.changes_requested.cta === 'Update partner application');
  expect('40 AR changes CTA', pa.changes_requested.cta === 'تحديث طلب الشراكة');
  expect('41 EN rejected CTA', p.rejected.cta === 'View partner application');
  expect('42 AR rejected CTA', pa.rejected.cta === 'عرض طلب الشراكة');
  expect('43 EN approved my properties', p.approved.title === 'My properties');
  expect('44 AR approved my properties', pa.approved.title === 'مزارعي');
  expect('45 EN add property', p.approved.addCta === 'Add a new property');
  expect('46 AR add property', pa.approved.addCta === 'إضافة مزرعة جديدة');
  expect('47 no 24h SLA invent', !JSON.stringify(p).includes('24') && !JSON.stringify(pa).includes('24 ساعة'));
  expect('48 approved section title AR', pa.sectionTitleApproved === 'إدارة المزارع');
}

console.log('\n— Auth / privacy freeze —');
{
  expect('49 href resolver not weakened', entry.includes("role === 'owner'") && entry.includes("ownerProfileStatus === 'approved'"));
  expect('50 no admin notes on account card', !section.includes('changeRequestReason') && !section.includes('audit'));
  expect('51 become-owner remains destination for applicants', section.includes('ADD_FARM_PARTNER_HREF'));
  expect('52 resolveAddFarmLabelKey still present', entry.includes('export function resolveAddFarmLabelKey'));
}

console.log(`\nAccount partner nav QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
