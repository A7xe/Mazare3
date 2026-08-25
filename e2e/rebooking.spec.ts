import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

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

test.describe('Fast rebooking (10E.3)', () => {
  test('customer books again from a past booking', async ({ page }) => {
    test.setTimeout(120_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const ensured = await fetch(`${getApiBase()}/internal/properties/${PROPERTY_SLUG}/ensure-available-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const ensuredBody = (await ensured.json()) as {
      data?: { date: string; period: string; price: number };
    };
    expect(ensured.status, `ensure slot ${ensured.status} ${JSON.stringify(ensuredBody)}`).toBe(200);
    const slot = {
      date: ensuredBody.data!.date,
      period: ensuredBody.data!.period,
    };
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
    const created = (await book.json()) as { data?: { id?: string; publicCode?: string } };
    const oldId = created.data?.id;
    const oldCode = created.data?.publicCode;
    expect(oldId).toBeTruthy();
    await payFully(cookie, oldId!);
    await fetch(`${getApiBase()}/internal/bookings/${oldId}/backdate-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/bookings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByTestId(`book-again-${oldId}`).click();
    await expect(page).toHaveURL(new RegExp(`/ar/properties/${PROPERTY_SLUG}`));
    await expect(page.getByTestId('rebook-banner')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('booking-guests')).toHaveValue('4');
    await expect(page.getByTestId('booking-date')).toHaveValue('');

    const nextEnsure = await fetch(`${getApiBase()}/internal/properties/${PROPERTY_SLUG}/ensure-available-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const nextBody = (await nextEnsure.json()) as { data?: { date: string; period: string } };
    const next = nextBody.data!;
    await page.getByTestId('booking-date').fill(next.date);
    await page.getByTestId(`booking-period-${next.period}`).click();
    await expect(page.getByTestId('booking-summary-deposit')).toBeVisible();
    const createdRes = page.waitForResponse(
      (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
    );
    await page.getByTestId('booking-submit').click();
    const posted = await createdRes;
    expect(posted.status()).toBe(201);
    await page.waitForURL(/\/(checkout|account\/bookings)/, { timeout: 25_000 });
    const url = page.url();
    if (url.includes('/checkout/')) {
      const newId = url.split('/checkout/')[1]?.split('?')[0];
      expect(newId).toBeTruthy();
      expect(newId).not.toBe(oldId);
    } else {
      const list = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
      const body = (await list.json()) as { data?: { id: string; publicCode: string }[] };
      const newest = body.data?.[0];
      expect(newest?.id).not.toBe(oldId);
      expect(newest?.publicCode).not.toBe(oldCode);
    }
  });
});
