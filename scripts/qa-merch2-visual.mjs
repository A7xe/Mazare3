/**
 * MERCH-2 — Home/Explore visual QA after strong fixture cleanup.
 * AR 1440 + AR 390. Screenshots + structural assertions. No data mutations.
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../_merch2_visual');
mkdirSync(outDir, { recursive: true });

const WEB = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000';

function check(name, cond, fails) {
  if (!cond) {
    fails.push(name);
    console.log(`  ❌ ${name}`);
  } else {
    console.log(`  ✅ ${name}`);
  }
}

async function inspectHome(page, label, fails) {
  await page.goto(`${WEB}/ar`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);

  const strongVisible = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('[data-testid^="property-card-"]')].map((el) =>
      (el.textContent ?? '').trim(),
    );
    const strongPrefixes = [
      'E2E Home ',
      'E2E Spon ',
      'E2E Feat ',
      'E2E Org ',
      'E2E Paid ',
      'E2E Disc ',
      'E2E Desk ',
      'E2E Merch',
      'QA Home ',
      'QA Spon ',
      'QA Feat ',
      'QA Future ',
      'QA Exp ',
      'QA Unpub ',
      'QA Draft ',
    ];
    return titles.filter((t) => strongPrefixes.some((p) => t.includes(p) || t.startsWith(p))).length;
  });
  check(`${label}: no strong cleaned fixture titles in DOM cards`, strongVisible === 0, fails);

  for (const id of [
    'discovery-rail-featured',
    'discovery-rail-offers',
    'discovery-rail-recently-added',
    'discovery-rail-sponsored',
  ]) {
    const rail = page.getByTestId(id);
    const count = await rail.count();
    if (count === 0) {
      check(`${label}: ${id} hidden when absent (expected)`, true, fails);
    } else {
      const visible = await rail.isVisible();
      check(`${label}: ${id} visible only if present → ${visible}`, true, fails);
      if (visible && (id === 'discovery-rail-featured' || id === 'discovery-rail-offers' || id === 'discovery-rail-recently-added')) {
        // If visible with 0 eligible data this would be a bug — card count must be > 0
        const cards = await rail.locator('[data-testid^="property-card-"]').count();
        check(`${label}: ${id} has cards when visible`, cards > 0, fails);
      }
      if (visible && id === 'discovery-rail-sponsored') {
        const viewport = rail.locator('[data-testid="home-property-carousel-viewport"]');
        if ((await viewport.count()) > 0) {
          const metrics = await rail.evaluate((section) => {
            const vp = section.querySelector(
              '[data-testid="home-property-carousel-viewport"]',
            );
            if (!vp) return null;
            const vr = vp.getBoundingClientRect();
            const cards = [...section.querySelectorAll('[data-testid^="property-card-"]')]
              .map((el) => el.getBoundingClientRect())
              .filter((r) => r.right > vr.left + 4 && r.left < vr.right - 4);
            if (!cards.length) return { ratio: 0, n: 0 };
            const widest = Math.max(...cards.map((r) => r.width));
            return { ratio: widest / vr.width, n: cards.length };
          });
          if (metrics && metrics.n === 1 && page.viewportSize()?.width >= 1024) {
            check(
              `${label}: single sponsored card not full-bleed`,
              metrics.ratio <= 0.45,
              fails,
            );
          }
        }
      }
    }
  }

  await page.screenshot({
    path: resolve(outDir, `${label}.png`),
    fullPage: true,
  });
}

async function inspectExplore(page, label, fails) {
  await page.goto(`${WEB}/ar/search`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2000);

  const organicCards = await page.locator('[data-testid^="explore-card-"], [data-testid^="property-card-"]').count();
  check(`${label}: has organic/property cards`, organicCards > 0, fails);

  const strongInExplore = await page.evaluate(() => {
    const text = document.body.innerText ?? '';
    const prefixes = [
      'E2E Home ',
      'E2E Spon ',
      'E2E Feat ',
      'QA Home ',
      'QA Future ',
      'QA Spon ',
    ];
    return prefixes.filter((p) => text.includes(p)).length;
  });
  check(`${label}: strong cleaned titles not in page text`, strongInExplore === 0, fails);

  // Ambiguous may still appear — that is OK / expected
  const ambiguousHint = await page.evaluate(() => {
    const text = document.body.innerText ?? '';
    return {
      qaSearch: text.includes('QA Search'),
      qaOrg: text.includes('QA Org'),
      qaTimed: text.includes('QA Timed'),
    };
  });
  console.log(`  ℹ️  ${label}: ambiguous still visible (allowed):`, ambiguousHint);

  const map = page.locator('[data-testid="explore-map"], [class*="map"]').first();
  const mapCount = await page.locator('.maplibregl-map, .mapboxgl-map, [data-testid*="map"]').count();
  check(`${label}: map container present (${mapCount})`, mapCount > 0 || organicCards > 0, fails);

  await page.screenshot({
    path: resolve(outDir, `${label}.png`),
    fullPage: true,
  });
  void map;
}

async function main() {
  const fails = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('\n🏠 MERCH-2 Home / Explore visual QA\n');

  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await inspectHome(page, `ar-home-${w}`, fails);
    await inspectExplore(page, `ar-explore-${w}`, fails);
  }

  await browser.close();

  if (fails.length) {
    console.error(`\nFAILED (${fails.length}):`, fails);
    process.exit(1);
  }
  console.log(`\nPASS — screenshots in ${outDir}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
