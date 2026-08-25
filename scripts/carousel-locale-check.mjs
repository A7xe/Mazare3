import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
for (const url of ['http://localhost:3000/ar', 'http://localhost:3000/en']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="home-city-destinations"]');
    const v = s?.querySelector('.overflow-hidden');
    const t = v?.firstElementChild;
    const vp = v.getBoundingClientRect();
    const children = Array.from(t.children);
    const vis = children.filter((el) => {
      const c = el.getBoundingClientRect();
      return c.width > 0 && c.left < vp.right && c.right > vp.left;
    });
    const style = t?.getAttribute('style') ?? '';
    const m = style.match(/translate3d\(([-\d.]+)px/);
    return {
      dir: document.documentElement.dir,
      trackDir: getComputedStyle(t).direction,
      visibleChildCount: vis.length,
      translatePx: m ? parseFloat(m[1]) : null,
      firstVisibleIndex: vis[0] ? children.indexOf(vis[0]) : null,
    };
  });
  console.log(url, JSON.stringify(r));
  await page.close();
}
await browser.close();
