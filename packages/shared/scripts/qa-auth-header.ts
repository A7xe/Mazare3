/**
 * Authenticated top header — breadcrumbs, chrome boundaries, i18n, marketplace scope.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-auth-header.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAuthenticatedAppPath,
  isExcludedFromAuthenticatedHeader,
  isOwnerAppPath,
  resolveAuthBreadcrumbs,
  shouldShowAuthenticatedHeader,
  userInitials,
} from '../../../apps/web/src/lib/auth-breadcrumbs.ts';

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

function keys(items: { key: string; literal?: string; href?: string }[]) {
  return items.map((i) => i.literal || i.key).join(' > ');
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const chrome = read('apps/web/src/components/layout/site-chrome.tsx');
const header = read('apps/web/src/components/layout/authenticated-top-header.tsx');
const layout = read('apps/web/src/app/[locale]/layout.tsx');
const notifications = read('apps/web/src/components/layout/auth-header-notifications.tsx');
const extras = read('apps/web/src/components/layout/auth-breadcrumb-extras.tsx');
const propertyDetail = read('apps/web/src/components/marketplace/property-detail-view.tsx');
const en = JSON.parse(read('apps/web/messages/en.json')) as {
  authHeader: { greeting: string; crumbs: Record<string, string> };
};
const ar = JSON.parse(read('apps/web/messages/ar.json')) as {
  authHeader: { greeting: string; crumbs: Record<string, string> };
};

console.log('\n— Resolver —');
{
  expect('1 home single crumb', keys(resolveAuthBreadcrumbs('/')) === 'home');
  expect('2 home no duplicate', resolveAuthBreadcrumbs('/').length === 1);
  expect(
    '3 explore browse crumbs',
    keys(resolveAuthBreadcrumbs('/search')) === 'home > explore',
  );
  expect(
    '4 search results crumbs',
    keys(resolveAuthBreadcrumbs('/search', { searchMode: true })) === 'home > searchResults',
  );
  expect(
    '5 public property uses title',
    keys(resolveAuthBreadcrumbs('/properties/la-vida-chalet', { propertyTitle: 'شاليه لافيدا' })) ===
      'home > explore > شاليه لافيدا',
  );
  expect(
    '6 public property no slug',
    !keys(resolveAuthBreadcrumbs('/properties/la-vida-chalet', { propertyTitle: 'شاليه لافيدا' })).includes(
      'la-vida-chalet',
    ),
  );
  expect('7 account crumbs', keys(resolveAuthBreadcrumbs('/account')) === 'home > account');
  expect(
    '8 bookings crumbs',
    keys(resolveAuthBreadcrumbs('/account/bookings')) === 'home > account > bookings',
  );
  expect(
    '9 partner application crumbs',
    keys(resolveAuthBreadcrumbs('/become-owner')) === 'home > account > partnerApplication',
  );
  expect(
    '10 owner properties crumbs',
    keys(resolveAuthBreadcrumbs('/owner/properties')) === 'home > propertyManagement > myProperties',
  );
  const pid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  expect(
    '11 owner property detail uses title',
    keys(resolveAuthBreadcrumbs(`/owner/properties/${pid}`, { propertyTitle: 'مزرعة النخيل' })) ===
      'home > propertyManagement > myProperties > مزرعة النخيل',
  );
  expect(
    '12 account current crumb has no href',
    resolveAuthBreadcrumbs('/account').at(-1)?.href === undefined,
  );
}

console.log('\n— Path gates —');
{
  expect('13 home shows header when authed', shouldShowAuthenticatedHeader('/'));
  expect('14 search shows header when authed', shouldShowAuthenticatedHeader('/search'));
  expect('15 property shows header when authed', shouldShowAuthenticatedHeader('/properties/demo'));
  expect('16 account shows header when authed', shouldShowAuthenticatedHeader('/account'));
  expect('17 become-owner shows header when authed', shouldShowAuthenticatedHeader('/become-owner'));
  expect('18 owner shows header when authed', shouldShowAuthenticatedHeader('/owner/properties'));
  expect('19 admin excluded', isExcludedFromAuthenticatedHeader('/admin'));
  expect('20 login excluded', isExcludedFromAuthenticatedHeader('/login'));
  expect('21 signup excluded', isExcludedFromAuthenticatedHeader('/signup'));
  expect('22 checkout excluded', isExcludedFromAuthenticatedHeader('/checkout'));
  expect('23 marketplace auth app path', isAuthenticatedAppPath('/search'));
  expect('24 owner path helper', isOwnerAppPath('/owner/properties/new') && !isOwnerAppPath('/account'));
}

console.log('\n— Initials —');
{
  expect('25 two-word initials', userInitials('زبون تجريبي', 'a@b.c') === 'زت');
  expect('26 email fallback', userInitials(null, 'owner1@mazare3.jo') === 'O');
  expect('27 no fake photo helper', !header.includes('unsplash') && !header.includes('pravatar'));
}

console.log('\n— Chrome / i18n —');
{
  expect('28 header mounted in SiteChrome', chrome.includes('AuthenticatedTopHeader'));
  expect('29 exclusion gating in SiteChrome', chrome.includes('shouldShowAuthenticatedHeader'));
  expect('30 admin/login/signup/checkout keep SiteHeader', chrome.includes('isAdminOrAuthOrCheckout'));
  expect('31 provider wraps layout main', layout.includes('AuthBreadcrumbExtrasProvider'));
  expect('32 unread badge gated', notifications.includes('unreadCount > 0'));
  expect('33 notifications link account page', notifications.includes('href="/account/notifications"'));
  expect('34 identity links /account', header.includes('href="/account"'));
  expect('35 extras hook clears on unmount', extras.includes('setPropertyTitle(null)'));
  expect('36 public property title wired', propertyDetail.includes('PublicPropertyBreadcrumbTitle'));
  expect('37 search mode in header', header.includes('isExploreTextSearchMode'));
  expect('38 AR greeting', ar.authHeader.greeting === 'مرحباً،');
  expect('39 EN greeting', en.authHeader.greeting === 'Hello,');
  expect('40 AR explore crumb', ar.authHeader.crumbs.explore === 'استكشف');
  expect('41 AR search results crumb', ar.authHeader.crumbs.searchResults === 'نتائج البحث');
  expect('42 AR partner crumb', ar.authHeader.crumbs.partnerApplication === 'طلب الشراكة');
  expect(
    '43 crumb keys match',
    JSON.stringify(Object.keys(ar.authHeader.crumbs).sort()) ===
      JSON.stringify(Object.keys(en.authHeader.crumbs).sort()),
  );
  expect('44 RTL chevron', header.includes('rtl:rotate-180'));
  expect('45 owner sticky opt-in', chrome.includes('sticky={owner}'));
  expect('46 owner mobile logout testid', header.includes('nav-logout-mobile'));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
