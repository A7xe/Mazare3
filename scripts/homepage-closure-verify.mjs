/**
 * Measure anonymous /auth/me count + verify real testimonials.
 */
import { chromium } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const BASE = 'http://localhost:3000';

async function measureAuthMe(locale) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const hits = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/auth/me')) {
      hits.push({ t: Date.now(), url: url.replace(/\?.*$/, ''), method: req.method() });
    }
  });
  await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle', timeout: 120_000 });
  const afterLoad = hits.length;
  const start = Date.now();
  await page.waitForTimeout(30_000);
  const duringIdle = hits.filter((h) => h.t >= start);
  const section = await page.locator('[data-testid="home-testimonials"]').count();
  const cards = await page.locator('[data-testid^="home-testimonial-"]').count();
  await browser.close();
  return {
    locale,
    authMeTotal: hits.length,
    authMeDuringLoad: afterLoad,
    authMeDuringIdle30s: duringIdle.length,
    testimonialsSectionPresent: section > 0,
    testimonialDomNodes: cards,
  };
}

async function main() {
  const api = await fetch(`${API}/properties/testimonials`, { cache: 'no-store' });
  const json = await api.json();
  const data = json.data ?? [];
  console.log('=== API /properties/testimonials ===');
  console.log('status', api.status, 'count', data.length);
  for (const row of data.slice(0, 8)) {
    console.log({
      id: row.id,
      rating: row.rating,
      name: row.customerDisplayName,
      city: row.propertyCity,
      property: row.propertyTitleEn,
      comment: String(row.comment).slice(0, 80),
    });
  }

  for (const locale of ['ar', 'en']) {
    console.log('\n=== auth/me measure', locale, '===');
    console.log(JSON.stringify(await measureAuthMe(locale), null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
