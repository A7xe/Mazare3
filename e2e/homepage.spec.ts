import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function createListing(titleEn: string, basePrice: number) {
  return createAndPublishTestProperty({ titleEn, basePrice });
}

function windowIso() {
  const s = new Date();
  s.setUTCDate(s.getUTCDate() - 1);
  const e = new Date();
  e.setUTCDate(e.getUTCDate() + 14);
  return { startsAt: s.toISOString(), endsAt: e.toISOString() };
}

test.describe('Phase 10F.4A homepage merchandising', () => {
  test('Arabic homepage rails use real sponsored, featured, offers, reviews', async ({ page }) => {
    test.setTimeout(180_000);
    const fixtures = new TestPropertyFixtureTracker();
    try {
      const stamp = Date.now();
      const sponsored = await createListing(`E2E Home S ${stamp}`, 1600);
      const featured = await createListing(`E2E Home F ${stamp}`, 900);
      const offer = await createListing(`E2E Home O ${stamp}`, 700);
      const rated = await createListing(`E2E Home R ${stamp}`, 800);
      const newest = await createListing(`E2E Home N ${stamp}`, 400);
      fixtures.trackMany([sponsored, featured, offer, rated, newest]);

      const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
      const win = windowIso();
      for (const [listing, type] of [
        [sponsored, 'sponsored'],
        [featured, 'featured'],
      ] as const) {
        const created = await api(admin, 'POST', `/admin/properties/${listing.id}/placements`, {
          placementType: type,
          ...win,
        });
        await api(
          admin,
          'POST',
          `/admin/properties/${listing.id}/placements/${created.json.data.id}/activate`,
        );
      }

      const promo = await api(sponsored.owner, 'POST', `/owner/properties/${offer.id}/promotions`, {
        titleAr: 'عرض تجريبي',
        titleEn: 'E2E offer',
        discountType: 'percentage',
        discountValue: 10,
        ...win,
        period: null,
      });
      await api(
        sponsored.owner,
        'POST',
        `/owner/properties/${offer.id}/promotions/${promo.json.data.id}/activate`,
      );

      const customer = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      const slot = await api(customer, 'POST', `/internal/properties/${rated.slug}/ensure-available-slot`);
      const book = await api(customer, 'POST', '/bookings', {
        propertySlug: rated.slug,
        date: slot.json.data.date,
        period: slot.json.data.period,
        guestsCount: 4,
      });
      const bookingId = book.json.data.id as string;
      const dep = await api(customer, 'POST', '/payments/create-intent', {
        bookingId,
        method: 'card',
        purpose: 'deposit',
      });
      await api(customer, 'POST', `/payments/${dep.json.data.id}/simulate-success`);
      const bal = await api(customer, 'POST', '/payments/create-intent', {
        bookingId,
        method: 'card',
        purpose: 'balance',
      });
      await api(customer, 'POST', `/payments/${bal.json.data.id}/simulate-success`);
      await api(customer, 'POST', `/internal/bookings/${bookingId}/backdate-slot`);
      await api(customer, 'POST', `/me/bookings/${bookingId}/review`, { rating: 5, comment: 'رائع' });

      await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await page.goto('/ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      const sponsoredRail = page.getByTestId('discovery-rail-sponsored');
      await expect(sponsoredRail).toBeVisible({ timeout: 45_000 });
      await expect(
        sponsoredRail.getByTestId(`property-card-${sponsored.slug}`).getByTestId('placement-badge-sponsored'),
      ).toHaveText('إعلان');

      const featuredRail = page.getByTestId('discovery-rail-featured');
      await expect(featuredRail).toBeVisible();
      await expect(
        featuredRail.getByTestId(`property-card-${featured.slug}`).getByTestId('placement-badge-featured'),
      ).toHaveText('مميز');

      const offersRail = page.getByTestId('discovery-rail-offers');
      await expect(offersRail).toBeVisible();
      await expect(offersRail.getByTestId(`property-card-${offer.slug}`).getByTestId('offer-badge')).toBeVisible();

      const topRail = page.getByTestId('discovery-rail-topRated');
      await expect(topRail).toBeVisible();
      await expect(topRail.getByTestId(`property-card-${rated.slug}`).getByTestId('property-card-rating')).toBeVisible();

      await expect(page.getByTestId('discovery-rail-recentlyAdded')).toBeVisible();

      await expect(featuredRail.getByTestId(`property-card-${sponsored.slug}`)).toHaveCount(0);
      await expect(offersRail.getByTestId(`property-card-${sponsored.slug}`)).toHaveCount(0);

      await sponsoredRail.getByTestId(`property-card-${sponsored.slug}`).click();
      await expect(page).toHaveURL(new RegExp(`/ar/properties/${sponsored.slug}`));
    } finally {
      await fixtures.dispose();
    }
  });
});
