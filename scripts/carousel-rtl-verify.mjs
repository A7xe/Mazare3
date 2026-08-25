/**
 * Post-fix verification for RTL carousel visibility.
 */
import { chromium } from '@playwright/test';

const SECTIONS = [
  ['City Destinations', 'home-city-destinations'],
  ['Ads / Sponsored', 'discovery-rail-sponsored'],
  ['Recently Added', 'discovery-rail-recentlyAdded'],
];

async function measure(page, testId) {
  return page.evaluate((tid) => {
    const section = document.querySelector(`[data-testid="${tid}"]`);
    if (!section) return { error: 'missing section' };
    const viewport = section.querySelector('.overflow-hidden');
    const track = viewport?.firstElementChild;
    if (!viewport || !track) return { error: 'missing viewport/track' };
    const vp = viewport.getBoundingClientRect();
    const children = Array.from(track.children);
    const visible = children.filter((el) => {
      const c = el.getBoundingClientRect();
      return c.width > 0 && c.left < vp.right && c.right > vp.left;
    });
    const first = children[0]?.getBoundingClientRect();
    const cardDir = children[0]?.getAttribute('dir') ?? getComputedStyle(children[0]).direction;
    const trackDir = getComputedStyle(track).direction;
    const viewportDir = getComputedStyle(viewport).direction;
    const style = track.getAttribute('style') ?? '';
    const m = style.match(/translate3d\(([-\d.]+)px/);
    return {
      trackChildCount: children.length,
      visibleChildCount: visible.length,
      visibleIndices: visible.map((el) => children.indexOf(el)),
      firstCardWidth: first ? Math.round(first.width) : 0,
      cardDir,
      trackDir,
      viewportDir,
      translatePx: m ? parseFloat(m[1]) : null,
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  }, testId);
}

async function clickNextAndRemeasure(page, testId) {
  const before = await measure(page, testId);
  await page.locator(`[data-testid="${testId}"] button`).nth(1).click();
  await page.waitForTimeout(450);
  const after = await measure(page, testId);
  return { beforeTranslate: before.translatePx, afterTranslate: after.translatePx, afterVisible: after.visibleChildCount };
}

async function runViewport(label, width, height) {
  const browser = await chromium.launch({ headless: true });
  console.log(`\n=== ${label} (${width}x${height}) ===`);

  for (const url of ['http://localhost:3000/ar', 'http://localhost:3000/en']) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForTimeout(1500);
    console.log(`\n${url}`);
    for (const [name, testId] of SECTIONS) {
      const r = await measure(page, testId);
      console.log(`  ${name}:`, JSON.stringify(r));
    }
    if (url.includes('/ar') && width >= 1024) {
      const nav = await clickNextAndRemeasure(page, 'home-city-destinations');
      console.log('  City next-click:', JSON.stringify(nav));
    }
    await page.close();
  }

  await browser.close();
}

await runViewport('Desktop', 1440, 900);
await runViewport('Mobile', 390, 844);
