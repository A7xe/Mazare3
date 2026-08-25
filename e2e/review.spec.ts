import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { findAvailableSlot, loginViaApi } from './helpers/api.js';

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

test.describe('Post-visit reviews (10E.1)', () => {
  test('customer can submit a review after the visit ends', async ({ page }) => {
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const slot = await findAvailableSlot({ minDaysAhead: 8, maxDaysAhead: 20 });
    const book = await fetch(`${getApiBase()}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        propertySlug: PROPERTY_SLUG,
        date: slot.date,
        period: slot.period,
        guestsCount: 4,
      }),
    });
    const created = (await book.json()) as { data?: { id?: string } };
    const bookingId = created.data?.id;
    expect(bookingId).toBeTruthy();
    await payFully(cookie, bookingId!);
    await fetch(`${getApiBase()}/internal/bookings/${bookingId}/backdate-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/bookings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const form = page.getByTestId(`booking-review-form-${bookingId}`);
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.getByTestId('review-star-5').click();
    await form.getByTestId('review-submit').click();
    await expect(page.getByTestId(`booking-review-done-${bookingId}`)).toBeVisible({ timeout: 20_000 });

    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.getByTestId('property-reviews-summary')).toBeVisible();
    await expect(page.getByTestId('property-reviews-list')).toContainText('5/5');
  });
});
