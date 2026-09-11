/**
 * CB-6 — Deposit vs Full initial payment choice (mock / test-provider only).
 * No real PayTabs financial smoke.
 */
import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import {
  cancelBookingViaApi,
  findAvailableSlot,
  loginViaApi,
} from './helpers/api.js';
import {
  clickBookNow,
  gotoProperty,
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { applySessionToPage } from './helpers/session.js';

test.describe.configure({ timeout: 120_000 });

async function createPendingPaymentBooking(page: import('@playwright/test').Page) {
  const slot = await findAvailableSlot({ minDaysAhead: 10, maxDaysAhead: 40 });
  await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  await gotoProperty(page, 'ar', PROPERTY_SLUG);
  await selectBookingSlot(page, slot, 3);
  await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
  await clickBookNow(page);
  await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
  await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 30_000 });
  const bookingId = page.url().split('/checkout/')[1]?.split('?')[0];
  expect(bookingId).toBeTruthy();
  return { bookingId: bookingId! };
}

async function fillDummyCard(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-paylib="number"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-paylib="number"]').fill('4111111111111111');
  await page.getByTestId('checkout-card-expmonth').scrollIntoViewIfNeeded();
  await page.getByTestId('checkout-card-expmonth').fill('12');
  await page.locator('[data-paylib="expyear"]').fill('30');
  await page.locator('[data-paylib="cvv"]').fill('123');
}

async function payWithManagedOrSimulate(
  page: import('@playwright/test').Page,
  choice: 'deposit' | 'full',
) {
  const option = page.getByTestId(`checkout-amount-option-${choice}`);
  if (await option.count()) {
    const selected = await option.getAttribute('data-selected');
    if (selected !== 'true') await option.click();
  }

  const useNew = page.getByTestId('checkout-use-new-card');
  if (await useNew.count()) await useNew.click();

  if (await page.getByTestId('checkout-managed-form').count()) {
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    return;
  }

  if (await page.getByTestId('checkout-simulate-success').count()) {
    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/account\/bookings|\/checkout\/.+\/return/, { timeout: 40_000 });
    return;
  }

  throw new Error('No managed form or simulate pay path available');
}

async function checkoutPayload(cookie: string, bookingId: string) {
  const res = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as { data?: Record<string, unknown> };
  return { status: res.status, data: body.data };
}

test.describe('CB-6 Deposit vs Full', () => {
  test.describe.configure({ mode: 'serial' });

  test('A/B/P/Q Deposit & Full selector UX (mobile + desktop)', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/checkout/${bookingId}`);
    await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('checkout-amount-option-deposit')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await page.getByTestId('checkout-amount-option-full').click();
    await expect(page.getByTestId('checkout-amount-option-full')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(page.getByTestId('checkout-remaining-zero')).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible();

    await cancelBookingViaApi(cookie, bookingId);
  });

  test('C Deposit + Managed Form / simulate', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await payWithManagedOrSimulate(page, 'deposit');

    const after = await checkoutPayload(cookie, bookingId);
    expect(after.status).toBe(200);
    const data = after.data as {
      paymentState?: string;
      isFullyPaid?: boolean;
      payment?: { purpose?: string };
      initialPaymentOptions?: unknown;
    };
    expect(data.payment?.purpose === 'deposit' || data.paymentState === 'deposit_paid').toBeTruthy();
    expect(data.isFullyPaid).not.toBe(true);
    expect(data.initialPaymentOptions == null).toBeTruthy();

    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('D/O Full + Managed Form / simulate then reload', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await payWithManagedOrSimulate(page, 'full');

    const after = await checkoutPayload(cookie, bookingId);
    expect(after.status).toBe(200);
    const data = after.data as {
      isFullyPaid?: boolean;
      paymentState?: string;
      duePurpose?: string | null;
      payment?: { purpose?: string };
    };
    expect(data.isFullyPaid === true || data.paymentState === 'fully_paid').toBeTruthy();
    expect(data.duePurpose == null).toBeTruthy();

    await page.goto(`/ar/checkout/${bookingId}`);
    await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);

    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('I switch before Pay creates no Payment', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.getByTestId('checkout-amount-option-full').click();
    await page.getByTestId('checkout-amount-option-deposit').click();
    await page.getByTestId('checkout-amount-option-full').click();

    const checkout = await checkoutPayload(cookie, bookingId);
    expect(checkout.status).toBe(200);
    const payment = (checkout.data as { payment?: { status?: string } } | undefined)?.payment;
    expect(payment == null || payment.status !== 'succeeded').toBeTruthy();

    await cancelBookingViaApi(cookie, bookingId);
  });

  test('L owner approval — no selector when pending approval', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const checkout = await checkoutPayload(cookie, bookingId);
    const status = (checkout.data as { status?: string })?.status;
    if (status === 'pending_owner_approval') {
      await page.goto(`/ar/checkout/${bookingId}`);
      await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);
    }
    await cancelBookingViaApi(cookie, bookingId);
  });

  test('N Deposit then balance — no Full selector', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await payWithManagedOrSimulate(page, 'deposit');

    await page.goto(`/ar/checkout/${bookingId}`);
    await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);
    const checkout = await checkoutPayload(cookie, bookingId);
    expect(checkout.status).toBe(200);
    const data = checkout.data as {
      duePurpose?: string | null;
      canPayBalance?: boolean;
      isFullyPaid?: boolean;
    };
    if (!data.isFullyPaid) {
      expect(data.duePurpose === 'balance' || data.canPayBalance === true).toBeTruthy();
    }

    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('E/F/G/H tamper + choice wiring', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible();
    await page.getByTestId('checkout-amount-option-full').click();

    const res = await fetch(`${getApiBase()}/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        bookingId,
        method: 'card',
        initialPaymentChoice: 'full',
        amount: 1,
        purpose: 'full',
        collectionMode: 'full',
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { amount?: number; purpose?: string } };
      expect(body.data?.purpose).toBe('full');
      expect(Number(body.data?.amount ?? 0)).toBeGreaterThan(1);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }

    await cancelBookingViaApi(cookie, bookingId);
  });
});
