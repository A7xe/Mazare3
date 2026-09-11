/**
 * DEMO-2 — Showcase presentation hygiene browser acceptance.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { getApiBase } from './constants.js';

const SHOT_DIR = path.join(process.cwd(), '_demo2_visual');
const SLUGS = [
  'sc26-wadi-sarw',
  'sc26-blue-palm',
  'sc26-telal-salt',
  'sc26-lavender',
] as const;

mkdirSync(SHOT_DIR, { recursive: true });

const CONTAMINATION =
  /QA Search|QA Timed|QA Org|QA Media|E2E Overlap|\bQA Timed\b|\bQA Search\b|Emerald Chalet|Naour Villa|owner1@mazare3\.jo|showcase\.2026|MAZARE3_SHOWCASE_2026|@mazare3\.local/i;

test.describe('DEMO-2 showcase presentation hygiene', () => {
  test('API discovery: showcase rails only; Top Rated / Most Booked absent', async () => {
    const res = await fetch(`${getApiBase()}/properties/discovery`);
    expect(res.ok).toBeTruthy();
    const json = (await res.json()) as {
      data: { sections: { id: string; properties: { slug: string; titleEn?: string; titleAr?: string }[] }[] };
    };
    const byId = Object.fromEntries((json.data.sections ?? []).map((s) => [s.id, s.properties ?? []]));

    expect((byId.featured ?? []).length).toBeGreaterThanOrEqual(1);
    expect((byId.offers ?? []).length).toBeGreaterThanOrEqual(1);
    expect((byId.sponsored ?? []).length).toBeGreaterThanOrEqual(1);
    expect((byId.recentlyAdded ?? []).length).toBeGreaterThanOrEqual(1);
    expect(byId.topRated ?? []).toHaveLength(0);
    expect(byId.mostBooked ?? []).toHaveLength(0);

    for (const section of Object.values(byId)) {
      for (const p of section) {
        expect(p.slug.startsWith('sc26-')).toBeTruthy();
        expect(`${p.titleEn ?? ''} ${p.titleAr ?? ''}`).not.toMatch(/\b(QA|E2E)\b/);
      }
    }

    const search = await fetch(
      `${getApiBase()}/properties?q=${encodeURIComponent('مزرعة')}&pageSize=48`,
    );
    expect(search.ok).toBeTruthy();
    const searchJson = (await search.json()) as { data: { slug: string; titleEn?: string }[] };
    const items = Array.isArray(searchJson.data) ? searchJson.data : [];
    expect(items.every((i) => i.slug.startsWith('sc26-'))).toBeTruthy();
    expect(items.some((i) => /QA|E2E/i.test(i.titleEn ?? ''))).toBeFalsy();
  });

  test('Home AR/EN has merchandising rails and no contamination', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('discovery-rail-offers')).toBeVisible();
    await expect(page.getByTestId('discovery-rail-sponsored')).toBeVisible();
    await expect(page.getByTestId('discovery-rail-recentlyAdded')).toBeVisible();
    await expect(page.getByTestId('discovery-rail-topRated')).toHaveCount(0);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(CONTAMINATION);
    await page.screenshot({ path: path.join(SHOT_DIR, 'home-ar-390.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'home-ar-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en');
    await expect(page.getByTestId('discovery-rail-featured')).toBeVisible({ timeout: 45_000 });
    const enBody = await page.locator('body').innerText();
    expect(enBody).not.toMatch(CONTAMINATION);
    await page.screenshot({ path: path.join(SHOT_DIR, 'home-en-390.png'), fullPage: true });
  });

  test('Explore AR no QA contamination', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/search');
    await expect(page.getByTestId('explore-search-results')).toBeVisible({ timeout: 45_000 });
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/QA Search|QA Timed|E2E Overlap|Emerald Chalet/i);
    await page.screenshot({ path: path.join(SHOT_DIR, 'explore-ar-390.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar/search');
    await page.screenshot({ path: path.join(SHOT_DIR, 'explore-ar-1440.png'), fullPage: true });
  });

  test('Search finds showcase only', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/ar/search?q=sc26-wadi-sarw');
    await expect(page.getByTestId('explore-card-sc26-wadi-sarw')).toBeVisible({ timeout: 45_000 });
  });

  for (const [idx, slug] of SLUGS.entries()) {
    test(`Detail ${slug} gallery 10/10`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/ar/properties/${slug}`);
      await expect(page.getByTestId('property-gallery')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('property-gallery')).toContainText('/ 10');
      await expect(page.getByTestId('booking-entry-card')).toBeVisible();
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/MAZARE3_SHOWCASE|showcase\.2026|@mazare3\.local/i);
      await page.screenshot({
        path: path.join(SHOT_DIR, `detail-${slug}-ar-390.png`),
        fullPage: true,
      });
      if (idx < 2) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`/ar/properties/${slug}`);
        await expect(page.getByTestId('property-gallery')).toContainText('/ 10');
        await page.screenshot({
          path: path.join(SHOT_DIR, `detail-${slug}-ar-1440.png`),
          fullPage: true,
        });
      }
    });
  }
});
