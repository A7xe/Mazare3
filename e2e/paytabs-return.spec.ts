import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import {
  createBookingViaApi,
  findAvailableSlot,
  loginViaApi,
} from './helpers/api.js';

function isForbiddenBrowserUrl(url: string) {
  if (url.includes('/api/payment-return/')) return false;
  return (
    url.includes('localhost:4000') ||
    url.includes('127.0.0.1:4000') ||
    url.includes('localhost:4010') ||
    url.includes('127.0.0.1:4010') ||
    /https:\/\/[^/]*trycloudflare\.com\/api\/v1\//.test(url)
  );
}

test.describe('PayTabs return page same-origin BFF', () => {
  test('pending, success, failure, auth isolation, no localhost API', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const cookie = await loginViaApi();
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    const slot = await findAvailableSlot({ minDaysAhead: 70, maxDaysAhead: 88 });
    const created = await createBookingViaApi(cookie, slot, 2);
    expect(created.status).toBe(201);
    expect(created.bookingId).toBeTruthy();
    const bookingId = created.bookingId!;

    const intent = await request.post(`${getApiBase()}/payments/create-intent`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { bookingId, method: 'card', purpose: 'deposit' },
    });
    expect(intent.status()).toBe(201);
    const paymentId = ((await intent.json()) as { data?: { id?: string } }).data?.id;
    expect(paymentId).toBeTruthy();

    const browserUrls: string[] = [];
    page.on('request', (req) => {
      browserUrls.push(req.url());
    });

    await page.goto(`/ar/checkout/${bookingId}/return?paymentId=${paymentId}`);
    await expect(page.getByTestId('checkout-return-page')).toBeVisible();
    await page.waitForRequest((req) => req.url().includes('/api/payment-return/'), {
      timeout: 20_000,
    });
    await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
      'data-status',
      'pending',
    );
    await expect(page.getByTestId('checkout-return-title')).toContainText('قيد المعالجة');

    const sameOrigin = browserUrls.filter((u) => u.includes('/api/payment-return/'));
    expect(sameOrigin.length).toBeGreaterThan(0);
    expect(browserUrls.filter(isForbiddenBrowserUrl)).toEqual([]);

    const stillPending = await request.get(`${getApiBase()}/payments/${paymentId}`, {
      headers: { Cookie: cookie },
    });
    expect(((await stillPending.json()) as { data?: { status?: string } }).data?.status).toBe(
      'pending',
    );

    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const denied = await request.get(`/api/payment-return/${paymentId}`, {
      headers: { Cookie: ownerCookie },
    });
    expect(denied.status()).toBeGreaterThanOrEqual(401);

    await request.post(`${getApiBase()}/payments/${paymentId}/simulate-success`, {
      headers: { Cookie: cookie },
    });
    await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
      'data-status',
      'succeeded',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('checkout-return-title')).toContainText('تم استلام الدفع');

    const afterSuccess = browserUrls.filter((u) => u.includes('/api/payment-return/')).length;
    await page.waitForTimeout(3500);
    const afterWait = browserUrls.filter((u) => u.includes('/api/payment-return/')).length;
    expect(afterWait - afterSuccess).toBeLessThanOrEqual(1);

    expect(browserUrls.filter(isForbiddenBrowserUrl)).toEqual([]);

    const failSlot = await findAvailableSlot({ minDaysAhead: 89, maxDaysAhead: 100 });
    const failBooking = await createBookingViaApi(cookie, failSlot, 2);
    expect(failBooking.status).toBe(201);
    const failIntent = await request.post(`${getApiBase()}/payments/create-intent`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { bookingId: failBooking.bookingId, method: 'card', purpose: 'deposit' },
    });
    const failPaymentId = ((await failIntent.json()) as { data?: { id?: string } }).data?.id;
    expect(failPaymentId).toBeTruthy();
    await request.post(`${getApiBase()}/payments/${failPaymentId}/simulate-failure`, {
      headers: { Cookie: cookie },
    });
    await page.goto(`/en/checkout/${failBooking.bookingId}/return?paymentId=${failPaymentId}`);
    await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
      'data-status',
      'failed',
    );
    await expect(page.getByTestId('checkout-return-title')).toContainText('Payment not completed');
    expect(browserUrls.filter(isForbiddenBrowserUrl)).toEqual([]);
  });
});
