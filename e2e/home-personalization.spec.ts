import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { ensureTestPropertyPublished } from './helpers/publish-test-property.js';

async function payFully(cookie: string, bookingId: string) {
  const base = getApiBase();
  for (const purpose of ['deposit', 'balance'] as const) {
    const intent = await fetch(`${base}/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ bookingId, method: 'card', purpose }),
    });
    const body = (await intent.json()) as { data?: { id?: string } };
    const paymentId = body.data?.id;
    if (!paymentId) throw new Error(`intent failed for ${purpose}`);
    await fetch(`${base}/payments/${paymentId}/simulate-success`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
  }
}

async function createPastBooking(cookie: string, slug: string) {
  const slotRes = await fetch(`${getApiBase()}/internal/properties/${slug}/ensure-available-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const slotBody = (await slotRes.json()) as { data?: { date: string; period: string } };
  const book = await fetch(`${getApiBase()}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      propertySlug: slug,
      date: slotBody.data!.date,
      period: slotBody.data!.period,
      guestsCount: 4,
    }),
  });
  const created = (await book.json()) as { data?: { id?: string } };
  const bookingId = created.data?.id;
  if (!bookingId) throw new Error('booking failed');
  await payFully(cookie, bookingId);
  await fetch(`${getApiBase()}/internal/bookings/${bookingId}/backdate-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return bookingId;
}

test.describe('Phase 10F.4B personalized homepage', () => {
  test('Arabic customer sees Book Again and Favorites; anonymous does not', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('discovery-rail-bookAgain')).toHaveCount(0);
    await expect(page.getByTestId('discovery-rail-yourFavorites')).toHaveCount(0);

    const customer = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const detail = await fetch(`${getApiBase()}/properties/${PROPERTY_SLUG}`, {
      headers: { Cookie: customer },
    });
    const detailBody = (await detail.json()) as { data?: { id?: string; slug?: string } };
    const propertyId = detailBody.data?.id;
    expect(propertyId).toBeTruthy();

    const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const list = await fetch(`${getApiBase()}/owner/properties`, { headers: { Cookie: owner } });
    const listBody = (await list.json()) as { data?: Array<{ id: string; slug: string }> };
    const other = listBody.data?.find((p) => p.slug !== PROPERTY_SLUG && p.slug);
    let favoriteSlug = PROPERTY_SLUG;
    if (other?.id) {
      await ensureTestPropertyPublished(other.id);
      favoriteSlug = other.slug;
      await fetch(`${getApiBase()}/me/favorites/${other.id}`, {
        method: 'POST',
        headers: { Cookie: customer },
      });
    }

    await createPastBooking(customer, PROPERTY_SLUG);
    await fetch(`${getApiBase()}/me/favorites/${propertyId}`, {
      method: 'POST',
      headers: { Cookie: customer },
    });

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('discovery-rail-bookAgain')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('احجز مرة أخرى').first()).toBeVisible();

    if (favoriteSlug !== PROPERTY_SLUG) {
      await expect(page.getByTestId('discovery-rail-yourFavorites')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('المفضلة لديك')).toBeVisible();
      await expect(
        page.getByTestId('discovery-rail-yourFavorites').getByTestId(`property-card-${PROPERTY_SLUG}`),
      ).toHaveCount(0);
    }

    const bookAgainCta = page.getByTestId('discovery-rail-bookAgain').locator('[data-testid^="book-again-cta-"]').first();
    await bookAgainCta.click();
    await expect(page).toHaveURL(new RegExp(`/ar/properties/${PROPERTY_SLUG}`));
    await expect(page).toHaveURL(/rebook=/);
    await expect(page.getByTestId('rebook-banner')).toBeVisible({ timeout: 20_000 });

    await page.goto('/ar');
    await expect(page.getByTestId('discovery-rail-bookAgain')).toBeVisible({ timeout: 45_000 });
    if (favoriteSlug !== PROPERTY_SLUG) {
      await page
        .getByTestId('discovery-rail-yourFavorites')
        .getByTestId(`property-card-${favoriteSlug}`)
        .click();
      await expect(page).toHaveURL(new RegExp(`/ar/properties/${favoriteSlug}`));
    } else {
      await page.getByTestId(`property-card-${PROPERTY_SLUG}`).first().click();
      await expect(page).toHaveURL(new RegExp(`/ar/properties/${PROPERTY_SLUG}`));
    }
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
