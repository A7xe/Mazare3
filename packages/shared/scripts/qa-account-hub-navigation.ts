/**
 * Focused Account hub navigation completeness (static).
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-account-hub-navigation.ts
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
const home = read('apps/web/src/components/account/account-home-view.tsx');
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const en = JSON.parse(read('apps/web/messages/en.json'));
const app = join(root, 'apps/web/src/app');

console.log('\n— Account hub routes exist —');
{
  const pages = [
    ['account home', '[locale]/account/page.tsx'],
    ['profile', '[locale]/account/profile/page.tsx'],
    ['bookings', '[locale]/account/bookings/page.tsx'],
    ['favorites', '[locale]/account/favorites/page.tsx'],
    ['notifications', '[locale]/account/notifications/page.tsx'],
    ['payment-methods', '[locale]/account/payment-methods/page.tsx'],
    ['support', '[locale]/account/support/page.tsx'],
    ['become-owner', '[locale]/become-owner/page.tsx'],
    ['contact', '[locale]/contact/page.tsx'],
    ['terms', '[locale]/terms/page.tsx'],
    ['owner properties', '[locale]/owner/properties/page.tsx'],
    ['owner new property', '[locale]/owner/properties/new/page.tsx'],
  ] as const;
  for (const [label, rel] of pages) {
    expect(`route ${label}`, existsSync(join(app, rel)));
  }
}

console.log('\n— Hub entries —');
{
  expect('bookings', home.includes("href: '/account/bookings'") && home.includes('account-home-bookings'));
  expect('favorites', home.includes("href: '/account/favorites'") && home.includes('account-home-favorites'));
  expect('payment once', (home.match(/\/account\/payment-methods/g) || []).length === 1);
  expect('payment testid', home.includes('account-home-payment-methods'));
  expect('profile', home.includes("href: '/account/profile'") && home.includes('account-home-profile'));
  expect('notifications', home.includes('account-home-notifications'));
  expect('support once in hubs', (home.match(/account-home-support/g) || []).length === 1);
  expect('contact', home.includes('account-home-contact') && home.includes("href: '/contact'"));
  expect('terms', home.includes('account-home-terms') && home.includes("href: '/terms'"));
  expect('logout', home.includes("testId: 'nav-logout'"));
  expect('language switch', home.includes('switchLocale'));
  expect('edit profile CTA', home.includes('account-edit-profile'));
}

console.log('\n— Partner role-aware hub —');
{
  expect('join row', home.includes('account-home-partner-join'));
  expect('continue row', home.includes('account-home-partner-continue'));
  expect('track row', home.includes('account-home-partner-track'));
  expect('update row', home.includes('account-home-partner-update'));
  expect('view row', home.includes('account-home-partner-view'));
  expect('approved properties', home.includes('account-home-partner-properties'));
  expect('approved add', home.includes('account-home-partner-add-property'));
  expect('uses ADD_FARM_PARTNER_HREF', home.includes('ADD_FARM_PARTNER_HREF'));
  expect('uses OWNER_PROPERTIES_HREF', home.includes('OWNER_PROPERTIES_HREF'));
  expect('no Join for approved path', home.includes("partnerSurface === 'approved'") && home.includes('OWNER_PROPERTIES_HREF'));
  expect('AR becomePartner', ar.accountHome.becomePartner === 'انضم كشريك');
  expect('EN becomePartner', en.accountHome.becomePartner === 'Become a partner');
}

console.log('\n— Safety —');
{
  expect('no giant AccountPartnerSection', !home.includes('<AccountPartnerSection'));
  expect('no AccountIdentitiesCard on home', !home.includes('AccountIdentitiesCard'));
}

console.log(`\nAccount hub QA: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
