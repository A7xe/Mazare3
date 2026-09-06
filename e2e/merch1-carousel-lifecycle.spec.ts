import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, getApiBase } from './constants.js';
import { loginViaApi } from './helpers/api.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import {
  TestPropertyFixtureTracker,
  unpublishTestProperties,
} from './helpers/cleanup-test-fixtures.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function windowIso() {
  const s = new Date();
  s.setUTCDate(s.getUTCDate() - 1);
  const e = new Date();
  e.setUTCDate(e.getUTCDate() + 14);
  return { startsAt: s.toISOString(), endsAt: e.toISOString() };
}

type CardMetrics = {
  viewportWidth: number;
  cardWidth: number;
  leftGap: number;
  rightGap: number;
  uniqueVisibleSlugs: number;
};

async function measureVisibleSponsoredCard(
  rail: import('@playwright/test').Locator,
  slug: string,
): Promise<CardMetrics | null> {
  return rail.evaluate((section, propertySlug) => {
    const viewport = section.querySelector(
      '[data-testid="home-property-carousel-viewport"]',
    ) as HTMLElement | null;
    if (!viewport) return null;
    const vr = viewport.getBoundingClientRect();
    const cards = [
      ...section.querySelectorAll(`[data-testid="property-card-${propertySlug}"]`),
    ] as HTMLElement[];
    const visible = cards
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.right > vr.left + 4 && r.left < vr.right - 4)
      .sort(
        (a, b) =>
          Math.abs((a.r.left + a.r.right) / 2 - (vr.left + vr.right) / 2) -
          Math.abs((b.r.left + b.r.right) / 2 - (vr.left + vr.right) / 2),
      )[0];
    if (!visible) return null;
    const cr = visible.r;
    const visibleSlugs = new Set<string>();
    for (const el of section.querySelectorAll('[data-testid^="property-card-"]')) {
      const r = el.getBoundingClientRect();
      if (r.right <= vr.left + 4 || r.left >= vr.right - 4) continue;
      const id = el.getAttribute('data-testid') ?? '';
      visibleSlugs.add(id.replace(/^property-card-/, ''));
    }
    return {
      viewportWidth: vr.width,
      cardWidth: cr.width,
      leftGap: cr.left - vr.left,
      rightGap: vr.right - cr.right,
      uniqueVisibleSlugs: visibleSlugs.size,
    };
  }, slug);
}

test.describe('MERCH carousel low-item layout', () => {
  test('owned sponsored card keeps normal width; never mutates unrelated placements', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixtures = new TestPropertyFixtureTracker();
    try {
      const stamp = Date.now();
      const listing = await createAndPublishTestProperty({
        titleEn: `E2E Merch2 S ${stamp}`,
        basePrice: 1100,
        area: `e2e-merch2-${stamp}`,
      });
      fixtures.track(listing.id);

      const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
      const beforeDisc = await api(admin, 'GET', '/properties/discovery');
      const beforeSponsored: string[] =
        beforeDisc.json?.data?.sections?.find((s: { id: string }) => s.id === 'sponsored')
          ?.propertyIds ?? [];
      const unrelatedBefore = beforeSponsored.filter((id) => id !== listing.id);

      const win = windowIso();
      const created = await api(admin, 'POST', `/admin/properties/${listing.id}/placements`, {
        placementType: 'sponsored',
        ...win,
      });
      await api(
        admin,
        'POST',
        `/admin/properties/${listing.id}/placements/${created.json.data.id}/activate`,
      );

      // Isolation rule: do NOT pause/unpublish any property we did not create.
      for (const [width, height, maxRatio] of [
        [1440, 900, 0.45],
        [1024, 800, 0.55],
        [390, 844, 1.01],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.goto('/ar');
        const rail = page.getByTestId('discovery-rail-sponsored');
        await expect(rail).toBeVisible({ timeout: 45_000 });
        await expect(rail.getByTestId(`property-card-${listing.slug}`).first()).toBeVisible();

        const metrics = await measureVisibleSponsoredCard(rail, listing.slug);
        expect(metrics).toBeTruthy();
        expect(metrics!.cardWidth / metrics!.viewportWidth).toBeLessThanOrEqual(maxRatio);
        if (width >= 1024) {
          expect(metrics!.viewportWidth - metrics!.cardWidth).toBeGreaterThan(120);
        }
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/en');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      const enRail = page.getByTestId('discovery-rail-sponsored');
      await expect(enRail).toBeVisible({ timeout: 45_000 });
      const enMetrics = await measureVisibleSponsoredCard(enRail, listing.slug);
      expect(enMetrics).toBeTruthy();
      expect(enMetrics!.cardWidth / enMetrics!.viewportWidth).toBeLessThanOrEqual(0.45);
      if (enMetrics!.uniqueVisibleSlugs === 1) {
        expect(enMetrics!.leftGap + 8).toBeLessThan(enMetrics!.rightGap);
      }

      await page.goto('/ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      const arRail = page.getByTestId('discovery-rail-sponsored');
      await expect(arRail).toBeVisible({ timeout: 45_000 });
      const arMetrics = await measureVisibleSponsoredCard(arRail, listing.slug);
      expect(arMetrics).toBeTruthy();
      expect(arMetrics!.cardWidth / arMetrics!.viewportWidth).toBeLessThanOrEqual(0.45);
      if (arMetrics!.uniqueVisibleSlugs === 1) {
        expect(arMetrics!.rightGap + 8).toBeLessThan(arMetrics!.leftGap);
      }

      // Prove unrelated sponsored placements (if any) were not paused by this test.
      for (const otherId of unrelatedBefore) {
        const placements = await api(admin, 'GET', `/admin/properties/${otherId}/placements`);
        const stillActive = (placements.json?.data ?? []).some(
          (row: { status?: string; placementType?: string }) =>
            row.placementType === 'sponsored' && row.status === 'active',
        );
        expect(stillActive).toBe(true);
      }
    } finally {
      await fixtures.dispose();
    }
  });
});

test.describe('MERCH fixture lifecycle', () => {
  test('created published property is unpublished after dispose (incl. after assert failure path)', async () => {
    test.setTimeout(120_000);
    const fixtures = new TestPropertyFixtureTracker();
    let propertyId = '';
    let slug = '';
    try {
      const listing = await createAndPublishTestProperty({
        titleEn: `E2E Merch2 Clean ${Date.now()}`,
        basePrice: 500,
      });
      propertyId = listing.id;
      slug = listing.slug;
      fixtures.track(listing.id);

      const pub = await fetch(`${getApiBase()}/properties/${slug}`);
      expect(pub.status).toBe(200);

      try {
        expect(false, 'intentional failure to prove finally cleanup').toBeTruthy();
      } catch {
        /* swallowed — dispose must still run below */
      }
    } finally {
      await fixtures.dispose();
    }

    expect(propertyId).toBeTruthy();
    const after = await fetch(`${getApiBase()}/properties/${slug}`);
    expect(after.status).toBe(404);

    const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const detail = await api(admin, 'GET', `/admin/properties/${propertyId}`);
    expect(detail.json.data.status).toBe('unpublished');

    await unpublishTestProperties([propertyId]);
  });
});
