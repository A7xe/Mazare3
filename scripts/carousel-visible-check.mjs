import { chromium } from '@playwright/test';

const URL = 'http://localhost:3000/ar';
const sections = [
  ['City Destinations', 'home-city-destinations'],
  ['Ads / Sponsored', 'discovery-rail-sponsored'],
  ['Recently Added', 'discovery-rail-recentlyAdded'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(2000);

for (const [name, testId] of sections) {
  const r = await page.evaluate((tid) => {
    const section = document.querySelector(`[data-testid="${tid}"]`);
    const viewport = section?.querySelector('.overflow-hidden');
    const track = viewport?.firstElementChild;
    const vp = viewport?.getBoundingClientRect();
    const children = track ? Array.from(track.children) : [];
    const visible = children.filter((el) => {
      const cr = el.getBoundingClientRect();
      return cr.width > 0 && cr.left < vp.right && cr.right > vp.left;
    });
    const style = track?.getAttribute('style') ?? '';
    const m = style.match(/translate3d\(([-\d.]+)px/);
    const translatePx = m ? parseFloat(m[1]) : null;
    const childRects = children.slice(0, 12).map((el, i) => {
      const cr = el.getBoundingClientRect();
      return {
        i,
        left: Math.round(cr.left),
        right: Math.round(cr.right),
        width: Math.round(cr.width),
        intersects: cr.width > 0 && cr.left < vp.right && cr.right > vp.left,
      };
    });
    const uniqueCount = Math.round(children.length / 3);
    return {
      uniqueItemsEstimate: uniqueCount,
      trackChildCount: children.length,
      visibleChildCount: visible.length,
      visibleIndices: visible.map((el) => children.indexOf(el)),
      viewportLeft: Math.round(vp?.left ?? 0),
      viewportRight: Math.round(vp?.right ?? 0),
      translatePx,
      transform: track ? getComputedStyle(track).transform : null,
      childRects,
    };
  }, testId);
  console.log(`\n${name}:`, JSON.stringify(r, null, 2));
}

await browser.close();
