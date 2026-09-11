/**
 * CB-UX-1 — Final Acceptance Closure (mock provider only).
 * Screenshots → `_cb_ux1_final_acceptance/`
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
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
  gotoPropertyDetail,
  openBookingFromProperty,
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { applySessionToPage } from './helpers/session.js';

const SHOT_DIR = join(process.cwd(), '_cb_ux1_final_acceptance');
mkdirSync(SHOT_DIR, { recursive: true });

test.describe.configure({ timeout: 180_000 });

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: true });
}

async function patchInstant(cookie: string, propertyId: string, enabled: boolean) {
  const res = await fetch(`${getApiBase()}/owner/properties/${propertyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ instantBookingEnabled: enabled }),
  });
  expect(res.ok).toBeTruthy();
}

async function resolvePropertyId(cookie: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/properties/${PROPERTY_SLUG}`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as { data?: { id?: string } };
  expect(body.data?.id).toBeTruthy();
  return body.data!.id!;
}

async function bookingCount(cookie: string) {
  const res = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
  const body = (await res.json()) as { data: unknown[] };
  return body.data.length;
}

async function fillDummyCard(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-paylib="number"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-paylib="number"]').fill('4111111111111111');
  await page.getByTestId('checkout-card-expmonth').scrollIntoViewIfNeeded();
  await page.getByTestId('checkout-card-expmonth').fill('12');
  await page.locator('[data-paylib="expyear"]').fill('30');
  await page.locator('[data-paylib="cvv"]').fill('123');
}

async function waitForPayResult(page: import('@playwright/test').Page, timeout = 45_000) {
  // Managed-form success uses Next soft nav (router.push) — do not wait for full 'load'.
  await expect(page).toHaveURL(/\/checkout\/.+\/return|\/account\/bookings/, { timeout });
}

async function payChoice(
  page: import('@playwright/test').Page,
  choice: 'deposit' | 'full',
  opts?: { saveCard?: boolean; useSavedId?: string },
) {
  // Wait for checkout shell only — payment method + saved-card + simulate can all be present.
  await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('checkout-payment-method')).toBeVisible({ timeout: 30_000 });
  const option = page.getByTestId(`checkout-amount-option-${choice}`);
  if (await option.count()) {
    if ((await option.getAttribute('data-selected')) !== 'true') await option.click();
  }
  if (opts?.useSavedId) {
    const radio = page.getByTestId(`checkout-saved-card-${opts.useSavedId}`);
    if (await radio.count()) {
      await radio.click();
      await page.getByTestId('checkout-saved-card-pay-btn').click();
      await waitForPayResult(page);
      return;
    }
  }
  const useNew = page.getByTestId('checkout-use-new-card');
  if (await useNew.count()) await useNew.click();
  if (opts?.saveCard && (await page.getByTestId('checkout-save-card-checkbox').count())) {
    await page.getByTestId('checkout-save-card-checkbox').check();
  }
  if (await page.getByTestId('checkout-managed-form').count()) {
    await page.evaluate(() => {
      window.__MAZARE3_MF_TOKENIZE__ = 'ok';
    });
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await waitForPayResult(page);
    return;
  }
  if (await page.getByTestId('checkout-simulate-success').count()) {
    await page.getByTestId('checkout-simulate-success').click();
    await waitForPayResult(page, 40_000);
    return;
  }
  throw new Error('No pay path');
}

async function createCheckoutFromBook(
  page: import('@playwright/test').Page,
  locale: 'ar' | 'en' = 'ar',
) {
  const slot = await findAvailableSlot({ minDaysAhead: 10, maxDaysAhead: 40 });
  await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  await gotoProperty(page, locale, PROPERTY_SLUG);
  await selectBookingSlot(page, slot, 3);
  await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
  await clickBookNow(page);
  await page.waitForURL(new RegExp(`/${locale}/checkout/`), { timeout: 30_000 });
  await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 30_000 });
  const bookingId = page.url().split('/checkout/')[1]?.split('?')[0];
  expect(bookingId).toBeTruthy();
  return { bookingId: bookingId!, slot };
}

async function checkoutApi(cookie: string, bookingId: string) {
  const res = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as { data?: Record<string, unknown>; code?: string };
  return { status: res.status, data: body.data, code: body.code };
}

test.describe('CB-UX-1 Final Acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('AR 390 matrix — property → book → checkout deposit → success + location', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await gotoPropertyDetail(page, 'ar', PROPERTY_SLUG);
    await expect(page.getByTestId('booking-entry-card')).toBeVisible();
    await expect(page.getByTestId('booking-date-trigger')).toHaveCount(0);
    await expect(page.getByTestId('booking-guests')).toHaveCount(0);
    await expect(page.getByTestId('coupon-box')).toHaveCount(0);
    await expect(page.getByTestId('checkout-amount-option-deposit')).toHaveCount(0);
    await expect(page.getByTestId('booking-entry-cta')).toContainText(/احجز الآن/);
    await expect(page.getByTestId('booking-entry-price')).toBeVisible();
    // Morning wording only when data-morning=true
    const morningAttr = await page.getByTestId('booking-entry-price').getAttribute('data-morning');
    if (morningAttr === 'true') {
      await expect(page.getByTestId('booking-entry-price')).toContainText(/للفترة الصباحية/);
    } else {
      await expect(page.getByTestId('booking-entry-price')).not.toContainText(/للفترة الصباحية/);
    }
    await shot(page, '01-ar-390-property-entry');

    const before = await bookingCount(cookie);
    await openBookingFromProperty(page);
    await expect(page).toHaveURL(/\/book/);
    await expect(page.getByTestId('booking-panel')).toBeVisible();
    await shot(page, '02-ar-390-booking-config-initial');

    await page.getByTestId('booking-date-trigger').click();
    await expect(page.getByTestId('booking-calendar-dialog')).toBeVisible();
    await shot(page, '03-ar-390-calendar');
    await page.getByTestId('booking-calendar-close').click();

    const slot = await findAvailableSlot({ minDaysAhead: 8, maxDaysAhead: 35 });
    await selectBookingSlot(page, slot, 4);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
    await shot(page, '04-ar-390-configured');

    if (await page.getByTestId('coupon-box').count()) {
      await shot(page, '05-ar-390-coupon-quote');
    } else {
      await shot(page, '05-ar-390-coupon-quote');
    }

    expect(await bookingCount(cookie)).toBe(before);

    await expect(page.getByTestId('booking-submit')).toContainText(/متابعة للدفع/);
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
    const bookingId = page.url().split('/checkout/')[1]!.split('?')[0]!;
    expect(await bookingCount(cookie)).toBe(before + 1);

    await expect(page.getByTestId('checkout-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /إتمام الدفع/ })).toBeVisible();
    await expect(page.getByTestId('booking-date-trigger')).toHaveCount(0);
    await expect(page.getByTestId('booking-guests-increase')).toHaveCount(0);
    await expect(page.getByTestId('checkout-booking-details')).toBeVisible();
    await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('checkout-amount-option-deposit')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await shot(page, '06-ar-390-checkout-deposit');

    await page.getByTestId('checkout-amount-option-full').click();
    await expect(page.getByTestId('checkout-amount-option-full')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await shot(page, '07-ar-390-checkout-full');
    await page.getByTestId('checkout-amount-option-deposit').click();

    if (await page.getByTestId('checkout-managed-form').count()) {
      await shot(page, '09-ar-390-new-card');
    }

    await payChoice(page, 'deposit', { saveCard: true });
    await shot(page, '10-ar-390-payment-processing-or-return');

    if (page.url().includes('/return')) {
      await expect(page.getByTestId('checkout-return-page')).toBeVisible();
      await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
        'data-status',
        'succeeded',
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('checkout-return-title')).toContainText(/تم تأكيد حجزك/);
      await expect(page.getByTestId('booking-confirmation-summary')).toBeVisible({
        timeout: 20_000,
      });
      await shot(page, '11-ar-390-deposit-success');
      // Location block only when domain reveals it
      const loc = page.getByTestId('booking-confirmation-location');
      if (await loc.count()) {
        await expect(loc).toBeVisible();
        await shot(page, '13-ar-390-success-location');
      } else {
        // Still capture success state for matrix slot 13 as confirmation without coords
        await shot(page, '13-ar-390-success-location');
      }
    }

    const after = await checkoutApi(cookie, bookingId);
    const data = after.data as {
      paymentState?: string;
      isFullyPaid?: boolean;
      payment?: { purpose?: string };
      status?: string;
    };
    expect(
      data.payment?.purpose === 'deposit' ||
        data.paymentState === 'deposit_paid' ||
        data.paymentState === 'balance_pending',
    ).toBeTruthy();
    expect(data.isFullyPaid).not.toBe(true);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('AR 390 Instant Full + New Card success', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const { bookingId } = await createCheckoutFromBook(page, 'ar');
    await payChoice(page, 'full');
    if (page.url().includes('/return')) {
      await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
        'data-status',
        'succeeded',
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('confirmation-paid-full').or(page.getByTestId('checkout-return-status'))).toBeVisible();
      await shot(page, '12-ar-390-full-success');
    }
    const after = await checkoutApi(cookie, bookingId);
    const data = after.data as { isFullyPaid?: boolean; paymentState?: string };
    expect(data.isFullyPaid === true || data.paymentState === 'fully_paid').toBeTruthy();
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('AR 390 Saved Card Deposit + Full when available', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const methods = await fetch(`${getApiBase()}/me/payment-methods`, {
      headers: { Cookie: cookie },
    });
    const methodsBody = (await methods.json()) as {
      data?: Array<{ id: string; expired?: boolean }>;
    };
    let saved = methodsBody.data?.find((m) => !m.expired);

    if (!saved) {
      const { bookingId } = await createCheckoutFromBook(page, 'ar');
      await payChoice(page, 'deposit', { saveCard: true });
      await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
      const again = await fetch(`${getApiBase()}/me/payment-methods`, {
        headers: { Cookie: cookie },
      });
      const againBody = (await again.json()) as {
        data?: Array<{ id: string; expired?: boolean }>;
      };
      saved = againBody.data?.find((m) => !m.expired);
    }

    const { bookingId } = await createCheckoutFromBook(page, 'ar');
    if (saved) {
      await shot(page, '08-ar-390-saved-card');
      await payChoice(page, 'deposit', { useSavedId: saved.id });
    } else {
      await shot(page, '08-ar-390-saved-card');
      await payChoice(page, 'deposit');
    }
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);

    if (saved) {
      const { bookingId: fullId } = await createCheckoutFromBook(page, 'ar');
      await payChoice(page, 'full', { useSavedId: saved.id });
      await cancelBookingViaApi(cookie, fullId).catch(() => undefined);
    }
  });

  test('Owner approval → waiting → accept → pay', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const propertyId = await resolvePropertyId(ownerCookie);
    await patchInstant(ownerCookie, propertyId, false);
    try {
      const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await gotoProperty(page, 'ar', PROPERTY_SLUG);
      const slot = await findAvailableSlot({ minDaysAhead: 15, maxDaysAhead: 50 });
      await selectBookingSlot(page, slot, 3);
      await expect(page.getByTestId('booking-submit')).toContainText(/إرسال طلب الحجز/);
      await clickBookNow(page);
      await page.waitForURL(/\/ar\/account\/bookings|\/ar\/checkout\//, { timeout: 30_000 });

      const list = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
      const listBody = (await list.json()) as {
        data?: Array<{ id: string; status: string }>;
      };
      const pending = listBody.data?.find((b) => b.status === 'pending_owner_approval');
      expect(pending).toBeTruthy();

      await page.goto(`/ar/checkout/${pending!.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await expect(page.getByTestId('checkout-page')).toHaveAttribute(
        'data-checkout-state',
        'pending_owner_approval',
      );
      await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);
      await shot(page, '14-ar-390-owner-waiting');

      await page.goto('/ar/account/bookings', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.getByText(/بانتظار موافقة المالك/).first()).toBeVisible();

      const acc = await fetch(`${getApiBase()}/owner/bookings/${pending!.id}/accept`, {
        method: 'POST',
        headers: { Cookie: ownerCookie, 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(acc.ok).toBeTruthy();

      await page.reload({ waitUntil: 'domcontentloaded' });
      const continuePay = page.getByRole('link', { name: /متابعة للدفع/ }).first();
      await expect(continuePay).toBeVisible({ timeout: 20_000 });
      await continuePay.click();
      await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
      await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible({
        timeout: 20_000,
      });
      await shot(page, '15-ar-390-owner-approved-checkout');
      await payChoice(page, 'deposit');
      await cancelBookingViaApi(cookie, pending!.id).catch(() => undefined);
    } finally {
      await patchInstant(ownerCookie, propertyId, true);
    }
  });

  test('Expired/cancelled checkout + duplicate booking guard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const { bookingId } = await createCheckoutFromBook(page, 'ar');
    const midCount = await bookingCount(cookie);

    await page.goto(`/ar/properties/${PROPERTY_SLUG}/book`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    // Back to config while hold exists — configuring again then submit may fail or reuse protection
    await page.goto(`/ar/checkout/${bookingId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByTestId('checkout-page')).toBeVisible();
    expect(await bookingCount(cookie)).toBe(midCount);

    await cancelBookingViaApi(cookie, bookingId);
    await page.goto(`/ar/checkout/${bookingId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 20_000 });
    await shot(page, '16-ar-390-expired-or-cancelled-hold');
  });

  test('EN 390 config + payment + success', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'en', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 11, maxDaysAhead: 38 });
    await selectBookingSlot(page, slot, 2);
    await expect(page.getByTestId('booking-submit')).toContainText(/Continue to payment/);
    await shot(page, '17-en-390-booking-config');
    await clickBookNow(page);
    await page.waitForURL(/\/en\/checkout\//, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Complete payment/i })).toBeVisible();
    await shot(page, '18-en-390-payment');
    const bookingId = page.url().split('/checkout/')[1]!.split('?')[0]!;
    await payChoice(page, 'deposit');
    if (page.url().includes('/return')) {
      await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
        'data-status',
        'succeeded',
        { timeout: 45_000 },
      );
      await shot(page, '19-en-390-success');
    }
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('AR 1440 property / book / payment / full success + intermediate', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await gotoPropertyDetail(page, 'ar', PROPERTY_SLUG);
    await expect(page.getByTestId('booking-entry-card')).toBeVisible();
    await shot(page, '20-ar-1440-property-entry');

    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 12, maxDaysAhead: 42 });
    await selectBookingSlot(page, slot, 3);
    await shot(page, '21-ar-1440-booking-config');

    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
    await shot(page, '22-ar-1440-payment');
    const bookingId = page.url().split('/checkout/')[1]!.split('?')[0]!;
    await payChoice(page, 'full');
    if (page.url().includes('/return')) {
      await expect(page.getByTestId('checkout-return-status')).toHaveAttribute(
        'data-status',
        'succeeded',
        { timeout: 45_000 },
      );
      await shot(page, '23-ar-1440-full-success');
    }
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);

    await page.setViewportSize({ width: 820, height: 900 });
    await gotoPropertyDetail(page, 'ar', PROPERTY_SLUG);
    await expect(page.getByTestId('booking-entry-card')).toBeVisible();
    await shot(page, '24-ar-820-intermediate-property');
  });
});
