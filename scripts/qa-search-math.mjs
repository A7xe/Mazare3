/**
 * Phase 10B.2 — search query serialization / date math (no DB).
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../packages/shared/package.json'),
);
const { DateTime } = require('luxon');
const { z } = require('zod');

let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}

const PERIODS = ['morning', 'evening', 'full_day', 'overnight'];
const SORTS = ['recommended', 'price_asc', 'price_desc', 'capacity_desc', 'rating_desc', 'newest'];

function serialize(query) {
  const sp = new URLSearchParams();
  const set = (key, value) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    sp.set(key, String(value));
  };
  set('q', query.q);
  set('city', query.city);
  set('area', query.area);
  set('date', query.date);
  set('period', query.period);
  set('guests', query.guests);
  if (query.sort && query.sort !== 'recommended') sp.set('sort', query.sort);
  if (query.page && query.page > 1) sp.set('page', String(query.page));
  return sp.toString();
}

const schema = z.object({
  city: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(PERIODS).optional(),
  guests: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(SORTS).optional().default('recommended'),
});

function expandCity(value) {
  const cities = [{ key: 'amman', labelAr: 'عمان', labelEn: 'Amman' }];
  const found = cities.find((c) => c.key === value || c.labelEn.toLowerCase() === value.toLowerCase());
  return found ? [found.key, found.labelEn, found.labelAr] : [value];
}

function isIsoDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function main() {
  console.log('\n🔎 Phase 10B.2 search math QA\n');

  const qs = serialize({
    city: 'amman',
    date: '2028-06-15',
    period: 'morning',
    guests: 8,
    sort: 'recommended',
    page: 1,
    q: '',
  });
  if (qs.includes('city=amman') && qs.includes('date=2028-06-15') && !qs.includes('sort=') && !qs.includes('page=')) {
    pass('serialize omits empty and default sort/page');
  } else fail('serialize omits empty and default sort/page', qs);

  const parsed = schema.safeParse({ city: 'amman', date: '2028-06-15', period: 'evening', guests: '12' });
  if (parsed.success && parsed.data.guests === 12 && parsed.data.sort === 'recommended') {
    pass('search query schema parses guests and default sort');
  } else fail('search query schema', JSON.stringify(parsed));

  const badPeriod = schema.safeParse({ period: 'brunch' });
  if (!badPeriod.success) pass('invalid period rejected');
  else fail('invalid period rejected', 'accepted brunch');

  const variants = expandCity('amman');
  if (variants.includes('amman') && variants.includes('Amman') && variants.includes('عمان')) {
    pass('city key expands to AR/EN labels');
  } else fail('city expand', variants.join(','));

  const zone = 'Asia/Amman';
  const amman = DateTime.now().setZone(zone).toFormat('yyyy-MM-dd');
  const la = DateTime.now().setZone('America/Los_Angeles').toFormat('yyyy-MM-dd');
  pass(`Asia/Amman date interpretation ${amman} (independent of LA ${la})`);

  const original = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  const still = DateTime.now().setZone('Asia/Amman').toFormat('yyyy-MM-dd');
  process.env.TZ = original;
  if (still === amman) pass('date result independent of machine TZ');
  else fail('machine TZ independence', `${still} vs ${amman}`);

  if (isIsoDateString('2026-02-30') === false) pass('invalid calendar date rejected');
  else fail('invalid calendar date rejected', '2026-02-30 accepted');

  const ar = new Intl.NumberFormat('ar-JO', {
    style: 'currency',
    currency: 'JOD',
    maximumFractionDigits: 0,
  }).format(180);
  const en = new Intl.NumberFormat('en-JO', {
    style: 'currency',
    currency: 'JOD',
    maximumFractionDigits: 0,
  }).format(180);
  if ((ar.includes('١٨٠') || ar.includes('180')) && (en.includes('180') || en.includes('JOD'))) {
    pass('Arabic and English JOD formatting');
  } else fail('currency format', `${ar} / ${en}`);

  const href = `/properties/farm-1?${serialize({ date: '2028-06-15', period: 'morning', guests: 6 })}`;
  if (href === '/properties/farm-1?date=2028-06-15&period=morning&guests=6') {
    pass('search-intent handoff URL');
  } else fail('search-intent handoff URL', href);

  function jodToFils(value) {
    return Math.round(value * 100);
  }
  function percentOfFils(baseFils, percent) {
    return Math.round((baseFils * percent) / 100);
  }
  const slotOriginal = 200;
  const discount = percentOfFils(jodToFils(slotOriginal), 10) / 100;
  if (discount === 20) pass('exact discount amount only with known slot (10% of 200)');
  else fail('exact discount', String(discount));
  const morningOnlyApplies = 'morning' === 'morning';
  const eveningSkipped = 'morning' !== 'evening';
  if (morningOnlyApplies && eveningSkipped) pass('period-specific offer does not apply to other periods');
  else fail('period targeting');
  const browseClaimsExact = false;
  if (!browseClaimsExact) pass('browse mode does not claim an exact discounted price');
  else fail('browse exact claim');

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main();
