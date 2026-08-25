/**
 * Homepage Final Audit — missing verification gaps (read-only).
 */
import { chromium } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const BASE = 'http://localhost:3000';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 7;

function daysAgo(iso) {
  return (Date.now() - new Date(iso).getTime()) / MS_PER_DAY;
}

async function fetchDiscovery() {
  const res = await fetch(`${API}/properties/discovery`, { cache: 'no-store' });
  const json = await res.json();
  return json.data ?? json;
}

function sectionProps(discovery, id) {
  return discovery.sections?.find((s) => s.id === id)?.properties ?? [];
}

async function auditCarousel(page, sectionTestId, resolveVisible) {
  const viewport = page.locator(`[data-testid="${sectionTestId}"] .overflow-hidden`).first();
  const track = viewport.locator('> div').first();
  const vpBox = await viewport.boundingBox();
  const width = vpBox?.width ?? 0;
  const configuredVisible = resolveVisible(width);

  const info = await page.evaluate((tid) => {
    const section = document.querySelector(`[data-testid="${tid}"]`);
    const vp = section?.querySelector('.overflow-hidden');
    const tr = vp?.firstElementChild;
    if (!vp || !tr) return { error: 'missing viewport/track' };
    const vpRect = vp.getBoundingClientRect();
    const children = Array.from(tr.children);
    const visible = children.filter((el) => {
      const c = el.getBoundingClientRect();
      return c.width > 0 && c.left < vpRect.right && c.right > vpRect.left;
    });
    const idOf = (el) => {
      const self = el.getAttribute('data-testid') ?? '';
      if (self.startsWith('property-card-')) return self.replace('property-card-', '');
      if (self.startsWith('city-destination-')) return self.replace('city-destination-', '');
      if (self.startsWith('home-testimonial-')) return self.replace('home-testimonial-', '');
      const link = el.querySelector('[data-testid^="property-card-"], [data-testid^="city-destination-"], [data-testid^="home-testimonial-"]');
      const tid2 = link?.getAttribute('data-testid') ?? '';
      return tid2.replace('property-card-', '').replace('city-destination-', '').replace('home-testimonial-', '');
    };
    const visibleIds = visible.map(idOf);
    const allIds = children.map(idOf).filter(Boolean);
    const uniqueSource = [...new Set(allIds)];
    const style = getComputedStyle(tr);
    return {
      trackChildCount: children.length,
      visibleCount: visible.length,
      visibleIds,
      uniqueSourceCount: uniqueSource.length,
      hasDuplicateVisible: visibleIds.length !== new Set(visibleIds).size,
      trackDir: style.direction,
      translate: style.transform,
      viewportDir: getComputedStyle(vp).direction,
      firstCardWidth: visible[0]?.getBoundingClientRect().width ?? 0,
      cardDir: visible[0] ? getComputedStyle(visible[0]).direction : null,
    };
  }, sectionTestId);

  const sourceCount = info.uniqueSourceCount ?? 0;
  const actualVisible = Math.min(sourceCount, configuredVisible);

  return {
    sectionTestId,
    viewportWidth: Math.round(width),
    sourceItemsLength: sourceCount,
    configuredResponsiveVisible: configuredVisible,
    actualVisible,
    formulaMatch: info.visibleCount === actualVisible,
    ...info,
  };
}

async function rapidClickTest(page, sectionTestId, direction = 'next') {
  const btn = page.locator(
    `[data-testid="${sectionTestId}"] button[aria-label="${direction === 'next' ? 'التالي' : 'السابق'}"], [data-testid="${sectionTestId}"] button[aria-label="${direction === 'next' ? 'Next' : 'Previous'}"]`,
  ).first();
  if (!(await btn.count())) return { skipped: true };

  const before = await page.evaluate((tid) => {
    const tr = document.querySelector(`[data-testid="${tid}"] .overflow-hidden > div`);
    return tr ? getComputedStyle(tr).transform : null;
  }, sectionTestId);

  for (let i = 0; i < 5; i++) await btn.click({ force: true });
  await page.waitForTimeout(800);

  const after = await page.evaluate(({ tid, beforeTransform }) => {
    const section = document.querySelector(`[data-testid="${tid}"]`);
    const vp = section?.querySelector('.overflow-hidden');
    const tr = vp?.firstElementChild;
    if (!vp || !tr) return { corrupt: true };
    const vpRect = vp.getBoundingClientRect();
    const visible = Array.from(tr.children).filter((el) => {
      const c = el.getBoundingClientRect();
      return c.width > 0 && c.left < vpRect.right && c.right > vpRect.left;
    });
    return {
      corrupt: visible.length === 0,
      visibleCount: visible.length,
      transform: getComputedStyle(tr).transform,
      changed: getComputedStyle(tr).transform !== beforeTransform,
    };
  }, { tid: sectionTestId, beforeTransform: before });

  return { before, after };
}

async function networkIdleAudit(page, locale) {
  const requests = [];
  const onReq = (req) => {
    const url = req.url();
    if (url.includes('/api/') || url.includes('localhost:4000')) {
      requests.push({ t: Date.now(), method: req.method(), url });
    }
  };
  page.on('request', onReq);
  await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle', timeout: 120_000 });
  const start = Date.now();
  await page.waitForTimeout(30_000);
  page.off('request', onReq);
  const duringIdle = requests.filter((r) => r.t >= start);
  const grouped = {};
  for (const r of duringIdle) {
    const key = r.url.replace(/\?.*$/, '');
    grouped[key] = (grouped[key] ?? 0) + 1;
  }
  return { locale, idleRequestCount: duringIdle.length, grouped };
}

async function consoleAudit(page, locale) {
  const messages = [];
  page.on('console', (msg) => {
    messages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    messages.push({ type: 'pageerror', text: err.message });
  });
  page.on('requestfailed', (req) => {
    messages.push({
      type: 'requestfailed',
      text: `${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`,
    });
  });
  const responses = [];
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('localhost:4000')) {
      responses.push({ status: res.status(), url });
    }
  });

  await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(3000);

  return {
    locale,
    console: messages,
    apiResponses: responses.filter((r) => r.status >= 400),
  };
}

async function main() {
  const discovery = await fetchDiscovery();
  const cutoff = Date.now() - RECENT_DAYS * MS_PER_DAY;
  const recent = sectionProps(discovery, 'recentlyAdded');
  const sponsored = sectionProps(discovery, 'sponsored');
  const over7 = recent.filter((p) => new Date(p.createdAt).getTime() < cutoff);
  const noCreated = recent.filter((p) => !p.createdAt);

  console.log('=== API: Recently Added 7-day rule ===');
  console.log('section present:', recent.length > 0);
  console.log('count:', recent.length);
  console.log('older than 7 days:', over7.length, over7.map((p) => ({ id: p.id, createdAt: p.createdAt, days: daysAgo(p.createdAt).toFixed(2) })));
  console.log('missing createdAt:', noCreated.length);
  if (recent.length) {
    console.log('ages (days):', recent.map((p) => daysAgo(p.createdAt).toFixed(2)));
  }

  console.log('\n=== API: City counts authoritative ===');
  console.log('cityPropertyCounts:', discovery.cityPropertyCounts);
  const sectionCityCounts = {};
  const seen = new Set();
  for (const s of discovery.sections ?? []) {
    for (const p of s.properties ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      sectionCityCounts[p.city] = (sectionCityCounts[p.city] ?? 0) + 1;
    }
  }
  console.log('section-derived amman (old bug pattern):', sectionCityCounts.amman ?? 0);
  console.log('authoritative amman:', discovery.cityPropertyCounts?.amman ?? 0);

  console.log('\n=== API: Sponsored placement truth ===');
  for (const p of sponsored.slice(0, 3)) {
    console.log({
      id: p.id,
      slug: p.slug,
      isSponsored: p.isSponsored,
      placementType: p.placementType,
    });
  }
  const fakeSponsored = sponsored.filter((p) => !p.isSponsored);
  console.log('sponsored rail items missing isSponsored:', fakeSponsored.length);

  console.log('\n=== API: Ratings / pricing sample ===');
  const sample = [...sponsored, ...recent].slice(0, 5);
  for (const p of sample) {
    console.log({
      slug: p.slug,
      rating: p.rating,
      reviewCount: p.reviewCount,
      basePrice: p.basePrice,
      currency: p.currency,
      hasActivePromotion: p.hasActivePromotion,
    });
  }
  const fakeRatings = sample.filter((p) => p.reviewCount === 0 && p.rating > 0);
  const nonJod = sample.filter((p) => p.currency && p.currency.toUpperCase() !== 'JOD');
  console.log('zero-review but rating>0:', fakeRatings.length);
  console.log('non-JOD currency:', nonJod.length);

  const browser = await chromium.launch({ headless: true });

  for (const locale of ['ar', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForTimeout(1500);

    console.log(`\n=== Carousel desktop 1440 (${locale}) ===`);
    const cityFn = (w) => (w >= 1024 ? 4 : w >= 768 ? 2 : 1);
    const propFn = (w) => (w >= 1024 ? 5 : w >= 768 ? 2 : 1);
    const testiFn = (w) => (w >= 1024 ? 3 : w >= 768 ? 2 : 1);

    for (const [tid, fn] of [
      ['home-city-destinations', cityFn],
      ['discovery-rail-sponsored', propFn],
      ['discovery-rail-recentlyAdded', propFn],
      ['home-testimonials', testiFn],
    ]) {
      const exists = (await page.locator(`[data-testid="${tid}"]`).count()) > 0;
      if (!exists) {
        console.log(`${tid}: NOT RENDERED (empty section)`);
        continue;
      }
      const c = await auditCarousel(page, tid, fn);
      console.log(tid, JSON.stringify(c));
      const rapid = await rapidClickTest(page, tid, 'next');
      console.log(`${tid} rapid-clicks:`, JSON.stringify(rapid));
    }

    await page.close();
  }

  for (const locale of ['ar', 'en']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForTimeout(1000);
    console.log(`\n=== Carousel mobile 390 (${locale}) ===`);
    const propFn = (w) => (w >= 1024 ? 5 : w >= 768 ? 2 : 1);
    for (const tid of ['home-city-destinations', 'discovery-rail-sponsored', 'discovery-rail-recentlyAdded']) {
      const exists = (await page.locator(`[data-testid="${tid}"]`).count()) > 0;
      if (!exists) {
        console.log(`${tid}: NOT RENDERED`);
        continue;
      }
      console.log(tid, JSON.stringify(await auditCarousel(page, tid, tid === 'home-city-destinations' ? (w) => (w >= 1024 ? 4 : w >= 768 ? 2 : 1) : propFn)));
    }
    await page.close();
  }

  for (const locale of ['ar', 'en']) {
    const page = await browser.newPage();
    const net = await networkIdleAudit(page, locale);
    console.log(`\n=== Network idle 30s (${locale}) ===`, JSON.stringify(net, null, 2));
    await page.close();
  }

  for (const locale of ['ar', 'en']) {
    const page = await browser.newPage();
    const con = await consoleAudit(page, locale);
    console.log(`\n=== Console (${locale}) ===`);
    console.log('API 4xx:', con.apiResponses);
    const interesting = con.console.filter((m) => m.type !== 'log' && m.type !== 'debug');
    console.log('Non-log console:', interesting.slice(0, 30));
    await page.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
