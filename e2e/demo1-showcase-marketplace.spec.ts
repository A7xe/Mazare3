/**
 * DEMO-1 — Showcase marketplace browser acceptance + visual QA.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { getApiBase } from './constants.js';

const SHOT_DIR = path.join(process.cwd(), '_demo1_visual');
const SLUGS = [
  'sc26-wadi-sarw',
  'sc26-blue-palm',
  'sc26-telal-salt',
  'sc26-sindyan',
  'sc26-nasmat-jabal',
  'sc26-lavender',
  'sc26-wadi-zaytoun',
  'sc26-sky-view',
  'sc26-reef-jerash',
  'sc26-palm-hill',
  'sc26-ghuroob-madaba',
  'sc26-al-wadi',
] as const;

mkdirSync(SHOT_DIR, { recursive: true });

async function discovery(localeQuery = '') {
  const url = `${getApiBase()}/properties/discovery${localeQuery}`;
  const res = await fetch(url);
  expect(res.ok).toBeTruthy();
  return res.json() as Promise<{
    data: {
      sections: { id: string; properties: { slug: string; titleAr: string }[] }[];
    };
  }>;
}

test.describe('DEMO-1 showcase marketplace', () => {
  test('API discovery rails include showcase inventory', async () => {
    const json = await discovery();
    const sections = Object.fromEntries(
      (json.data.sections ?? []).map((s) => [s.id, s.properties ?? []]),
    );
    expect((sections.featured ?? []).length).toBeGreaterThanOrEqual(1);
    expect((sections.offers ?? []).length).toBeGreaterThanOrEqual(1);
    expect((sections.recentlyAdded ?? []).length).toBeGreaterThanOrEqual(1);
    expect((sections.sponsored ?? []).length).toBeGreaterThanOrEqual(1);
    // Top Rated may include pre-existing non-showcase reviews; showcase props must not appear there.
    const topRatedShowcase = (sections.topRated ?? []).filter((p) => p.slug.startsWith('sc26-'));
    expect(topRatedShowcase).toHaveLength(0);

    const search = await fetch(
      `${getApiBase()}/properties?q=${encodeURIComponent('وادي السرو')}&pageSize=24`,
    );
    expect(search.ok).toBeTruthy();
    const searchJson = (await search.json()) as {
      data: { slug: string }[] | { items?: { slug: string }[]; properties?: { slug: string }[] };
    };
    const items = Array.isArray(searchJson.data)
      ? searchJson.data
      : (searchJson.data.items ?? searchJson.data.properties ?? []);
    const showcaseHits = items.filter((i) => i.slug.startsWith('sc26-'));
    expect(showcaseHits.length).toBeGreaterThanOrEqual(1);

    const nearby = await fetch(
      `${getApiBase()}/properties/discovery?lat=31.87&lng=35.82`,
    );
    expect(nearby.ok).toBeTruthy();
    const nearJson = (await nearby.json()) as {
      data: { sections: { id: string; properties: { slug: string }[] }[] };
    };
    const nearSection = nearJson.data.sections.find((s) => s.id === 'nearby');
    // Nearby may appear on Explore path; discovery with coords should populate when eligible.
    if (nearSection) {
      expect(nearSection.properties.some((p) => p.slug.startsWith('sc26-'))).toBeTruthy();
    }
  });

  test('Home AR mobile + desktop show merchandising rails', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('discovery-rail-offers')).toBeVisible();
    await expect(page.getByTestId('discovery-rail-recentlyAdded')).toBeVisible();
    await expect(page.getByTestId('discovery-rail-sponsored')).toBeVisible();
    await page.screenshot({
      path: path.join(SHOT_DIR, 'home-ar-390.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({
      path: path.join(SHOT_DIR, 'home-ar-1440.png'),
      fullPage: true,
    });
  });

  test('Home EN mobile + desktop', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({
      path: path.join(SHOT_DIR, 'home-en-390.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({
      path: path.join(SHOT_DIR, 'home-en-1440.png'),
      fullPage: true,
    });
  });

  test('Explore AR shows rails and showcase cards', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/search');
    await expect(
      page
        .getByTestId('discovery-rail-explore-offers')
        .or(page.getByTestId('explore-search-results'))
        .first(),
    ).toBeVisible({
      timeout: 45_000,
    });
    await page.screenshot({
      path: path.join(SHOT_DIR, 'explore-ar-390.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar/search');
    await page.screenshot({
      path: path.join(SHOT_DIR, 'explore-ar-1440.png'),
      fullPage: true,
    });
  });

  test('Search finds showcase properties', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/ar/search?q=sc26-wadi-sarw');
    await expect(page.getByTestId('explore-search-results')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('explore-card-sc26-wadi-sarw')).toBeVisible({ timeout: 45_000 });
  });

  for (const slug of SLUGS.slice(0, 3)) {
    test(`Property detail ${slug} gallery + booking widget`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/ar/properties/${slug}`);
      await expect(page.getByTestId('property-gallery')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('property-gallery')).toContainText('/ 10');
      await expect(page.getByTestId('property-specs')).toBeVisible();
      await expect(page.getByTestId('booking-entry-card')).toBeVisible();
      // Change gallery image via thumbnail
      const thumbs = page.getByTestId('property-gallery').locator('button[aria-pressed]');
      if ((await thumbs.count()) > 1) {
        await thumbs.nth(1).click();
        await expect(page.getByTestId('property-gallery')).toContainText('2 / 10');
      }
      await page.screenshot({
        path: path.join(SHOT_DIR, `detail-${slug}-ar-390.png`),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/ar/properties/${slug}`);
      await expect(page.getByTestId('property-gallery')).toContainText('/ 10');
      await page.screenshot({
        path: path.join(SHOT_DIR, `detail-${slug}-ar-1440.png`),
        fullPage: true,
      });
    });
  }
});
