/**
 * DEMO-1 — Showcase property media assertions.
 * Run: pnpm --filter @mazare3/db exec dotenv -e ../../.env -- tsx prisma/qa-showcase-property-media.ts
 */
import './load-env.js';
import {
  SHOWCASE_MARKER,
  SHOWCASE_PROPERTIES,
  SHOWCASE_SLUG_PREFIX,
  imagesForProperty,
} from './showcase-manifest.js';
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();
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

async function headOk(url: string): Promise<{ ok: boolean; contentType: string; bytes: number }> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? '';
    return { ok: res.ok && contentType.includes('image') && buf.length > 8_000, contentType, bytes: buf.length };
  } catch {
    return { ok: false, contentType: '', bytes: 0 };
  }
}

async function main() {
  console.log(`\n— qa-showcase-property-media (${SHOWCASE_MARKER}) —\n`);

  const props = await prisma.property.findMany({
    where: { slug: { startsWith: SHOWCASE_SLUG_PREFIX } },
    include: { media: { orderBy: { sortOrder: 'asc' } } },
  });

  expect('12 showcase properties', props.length === 12, `got ${props.length}`);

  let totalMedia = 0;
  for (const p of props) {
    totalMedia += p.media.length;
    expect(`${p.slug} has exactly 10 media`, p.media.length === 10, `got ${p.media.length}`);
    const orders = p.media.map((m) => m.sortOrder);
    expect(`${p.slug} sortOrder 0..9`, orders.join(',') === '0,1,2,3,4,5,6,7,8,9');
    const urls = p.media.map((m) => m.url);
    expect(`${p.slug} unique URLs`, new Set(urls).size === 10);
    expect(`${p.slug} cover sortOrder 0`, p.media[0]?.sortOrder === 0 && Boolean(p.media[0]?.url));
    expect(
      `${p.slug} no private KYC storageKey`,
      p.media.every((m) => m.storageKey == null || !String(m.storageKey).includes('kyc')),
    );
    expect(
      `${p.slug} public image hosts`,
      p.media.every(
        (m) =>
          m.url.startsWith('https://images.unsplash.com/') ||
          m.url.includes('.r2.dev/') ||
          ((m.storageKey ?? '').startsWith('properties/') && m.url.startsWith('https://')),
      ),
    );
  }
  expect('120 total media rows', totalMedia === 120, `got ${totalMedia}`);

  // Spot-check 6 URLs (cover + mid of 3 properties) for HTTP image validity
  const sample = props.slice(0, 3).flatMap((p) => [p.media[0]!, p.media[5]!]);
  for (const m of sample) {
    const check = await headOk(m.url);
    expect(
      `HTTP image ok (${m.url.slice(0, 60)}…)`,
      check.ok,
      `ct=${check.contentType} bytes=${check.bytes}`,
    );
  }

  // Manifest alignment (source pool). After R2 migration, URLs differ but counts/order remain.
  for (const def of SHOWCASE_PROPERTIES) {
    const expected = imagesForProperty(def.num);
    const row = props.find((p) => p.slug === def.slug);
    expect(`manifest images for ${def.slug}`, Boolean(row));
    if (row) {
      expect(`${def.slug} has 10 media (post-migrate ok)`, row.media.length === expected.length);
      const onR2 = row.media.every((m) => (m.storageKey ?? '').startsWith('properties/'));
      if (onR2) {
        expect(`${def.slug} R2 keys present`, true);
      } else {
        expect(
          `${def.slug} matches manifest URLs`,
          row.media.map((m) => m.url).join('|') === expected.map((i) => i.url).join('|'),
        );
      }
    }
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
