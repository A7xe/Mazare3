/**
 * Phase 3C.2 — Legal footer / public route smoke assertions (AR + EN slugs).
 * Run: pnpm qa:phase3c2-legal-links
 *
 * Checks that footer HELP_LINKS and app routes exist for every public legal slug.
 * Does not hit a live server.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const LEGAL_SLUGS = [
  'about',
  'contact',
  'terms',
  'privacy',
  'cancellation-refund',
  'booking-payment',
  'verification',
  'cookie-policy',
  'community-reviews',
] as const;

console.log('\nPhase 3C.2 Legal Link Smoke\n');

const footerPath = 'apps/web/src/components/layout/site-footer.tsx';
const footer = readFileSync(resolve(root, footerPath), 'utf8');

for (const slug of LEGAL_SLUGS) {
  expect(
    `footer links /${slug}`,
    footer.includes(`href: '/${slug}'`) || footer.includes(`href: "/${slug}"`),
    `missing HELP_LINKS entry for /${slug} in ${footerPath}`,
  );

  const pagePath = resolve(root, `apps/web/src/app/[locale]/${slug}/page.tsx`);
  expect(`AR/EN page exists for ${slug}`, existsSync(pagePath), `missing ${pagePath}`);
}

// Locale-aware routing uses [locale] — both ar and en share the same page module.
expect(
  'locale layout present',
  existsSync(resolve(root, 'apps/web/src/app/[locale]/layout.tsx')),
);

const en = readFileSync(resolve(root, 'apps/web/messages/en.json'), 'utf8');
const ar = readFileSync(resolve(root, 'apps/web/messages/ar.json'), 'utf8');
for (const slug of LEGAL_SLUGS) {
  expect(`en.json legal.nav.${slug}`, en.includes(`"${slug}"`), `nav key ${slug} missing in en`);
  expect(`ar.json legal.nav.${slug}`, ar.includes(`"${slug}"`), `nav key ${slug} missing in ar`);
}

// API public document + versions routes
const legalRoutes = readFileSync(resolve(root, 'apps/api/src/routes/legal.ts'), 'utf8');
expect('GET /legal/documents/:type', legalRoutes.includes("'/documents/:type'"));
expect(
  'GET /legal/documents/:type/versions',
  legalRoutes.includes("'/documents/:type/versions'"),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
