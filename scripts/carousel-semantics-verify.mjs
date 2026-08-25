/**
 * Read-only semantic verification of homepage carousel sources (no code changes).
 */
import { chromium } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const URL = 'http://localhost:3000/ar';

function daysAgo(iso) {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

async function main() {
  const res = await fetch(`${API}/properties/discovery`, { cache: 'no-store' });
  const json = await res.json();
  const data = json.data ?? json;
  const byId = {};
  for (const s of data.sections ?? []) {
    byId[s.id] = s.properties ?? [];
  }

  const sponsored = byId.sponsored ?? [];
  const recentlyAdded = byId.recentlyAdded ?? [];
  const featured = byId.featured ?? [];

  console.log('=== API source counts (before DOM cloning) ===');
  console.log('sponsored:', sponsored.length, sponsored.map((p) => p.id));
  console.log('recentlyAdded:', recentlyAdded.length);
  for (const p of recentlyAdded) {
    console.log(
      `  ${p.id} createdAt=${p.createdAt} ageDays=${daysAgo(p.createdAt).toFixed(2)} title=${p.titleEn ?? p.slug}`,
    );
  }
  console.log(
    'oldest recentlyAdded createdAt:',
    recentlyAdded.length
      ? recentlyAdded.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt
      : null,
  );

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - sevenDaysMs;
  const over7 = recentlyAdded.filter((p) => new Date(p.createdAt).getTime() < cutoff);
  console.log('recentlyAdded items older than 7 days:', over7.length, over7.map((p) => ({ id: p.id, createdAt: p.createdAt, ageDays: daysAgo(p.createdAt).toFixed(2) })));

  const featuredIds = new Set(featured.map((p) => p.id));
  const sponsoredIds = new Set(sponsored.map((p) => p.id));
  const overlapFeatured = recentlyAdded.filter((p) => featuredIds.has(p.id));
  const overlapSponsored = recentlyAdded.filter((p) => sponsoredIds.has(p.id));
  console.log('recentlyAdded also in featured:', overlapFeatured.map((p) => p.id));
  console.log('recentlyAdded also in sponsored:', overlapSponsored.map((p) => p.id));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(1500);

  const city = await page.evaluate(() => {
    const section = document.querySelector('[data-testid="home-city-destinations"]');
    const viewport = section?.querySelector('.overflow-hidden');
    const track = viewport?.firstElementChild;
    const vp = viewport.getBoundingClientRect();
    const children = Array.from(track.children);
    const visible = children.filter((el) => {
      const c = el.getBoundingClientRect();
      return c.width > 0 && c.left < vp.right && c.right > vp.left;
    });
    const allKeys = children.map((el) => el.getAttribute('data-testid')?.replace('city-destination-', ''));
    const uniqueSource = [...new Set(allKeys)];
    const visibleKeys = visible.map((el) => el.getAttribute('data-testid')?.replace('city-destination-', ''));
    return {
      sourceCount: uniqueSource.length,
      visibleKeys,
      visibleUniqueCount: new Set(visibleKeys).size,
      hasDuplicateVisible: visibleKeys.length !== new Set(visibleKeys).size,
    };
  });

  async function propertySection(testId) {
    return page.evaluate((tid) => {
      const section = document.querySelector(`[data-testid="${tid}"]`);
      const viewport = section?.querySelector('.overflow-hidden');
      const track = viewport?.firstElementChild;
      const vp = viewport.getBoundingClientRect();
      const children = Array.from(track.children);
      const visible = children.filter((el) => {
        const c = el.getBoundingClientRect();
        return c.width > 0 && c.left < vp.right && c.right > vp.left;
      });
      const idOf = (el) => {
        const link = el.querySelector('[data-testid^="property-card-"]');
        return link?.getAttribute('data-testid')?.replace('property-card-', '') ?? null;
      };
      const allSlugs = children.map(idOf);
      const uniqueSource = [...new Set(allSlugs)];
      const visibleSlugs = visible.map(idOf);
      return {
        sourceCount: uniqueSource.length,
        trackChildren: children.length,
        visibleSlugs,
        visibleUniqueCount: new Set(visibleSlugs).size,
        hasDuplicateVisible: visibleSlugs.length !== new Set(visibleSlugs).size,
      };
    }, testId);
  }

  const ads = await propertySection('discovery-rail-sponsored');
  const recent = await propertySection('discovery-rail-recentlyAdded');

  console.log('\n=== DOM visible (desktop 1440) ===');
  console.log('Cities:', city);
  console.log('Ads:', ads);
  console.log('Recently Added:', recent);

  // Map visible slugs back to createdAt from API
  const recentBySlug = Object.fromEntries(recentlyAdded.map((p) => [p.slug, p]));
  console.log('\nVisible Recently Added createdAt:');
  for (const slug of recent.visibleSlugs) {
    const p = recentBySlug[slug];
    console.log(`  ${slug}: ${p?.createdAt ?? 'NOT IN API SOURCE'} ageDays=${p ? daysAgo(p.createdAt).toFixed(2) : 'n/a'}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
