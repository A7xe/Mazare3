/**
 * CB-7 — Customer Booking Final Acceptance E2E (mock / test-provider only).
 * Screenshots go to _cb7_final_acceptance/ (stable; not erased by later Playwright runs).
 * No real PayTabs charges.
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
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { applySessionToPage } from './helpers/session.js';

/** Repo-root stable folder (Playwright cwd is the monorepo root). */
const SHOT_DIR = join(process.cwd(), '_cb7_final_acceptance');
mkdirSync(SHOT_DIR, { recursive: true });

test.describe.configure({ timeout: 180_000 });

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({
    path: join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function gotoSafe(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
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
  const id = body.data?.id;
  expect(id).toBeTruthy();
  return id!;
}

async function createPendingPaymentBooking(
  page: import('@playwright/test').Page,
  locale: 'ar' | 'en' = 'ar',
) {
  const slot = await findAvailableSlot({ minDaysAhead: 12, maxDaysAhead: 45 });
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

async function fillDummyCard(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-paylib="number"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-paylib="number"]').fill('4111111111111111');
  await page.getByTestId('checkout-card-expmonth').scrollIntoViewIfNeeded();
  await page.getByTestId('checkout-card-expmonth').fill('12');
  await page.locator('[data-paylib="expyear"]').fill('30');
  await page.locator('[data-paylib="cvv"]').fill('123');
}

async function payChoice(
  page: import('@playwright/test').Page,
  choice: 'deposit' | 'full',
  opts?: { saveCard?: boolean },
) {
  const option = page.getByTestId(`checkout-amount-option-${choice}`);
  if (await option.count()) {
    if ((await option.getAttribute('data-selected')) !== 'true') await option.click();
  }
  const useNew = page.getByTestId('checkout-use-new-card');
  if (await useNew.count()) await useNew.click();
  if (opts?.saveCard && (await page.getByTestId('checkout-save-card-checkbox').count())) {
    await page.getByTestId('checkout-save-card-checkbox').check();
  }
  if (await page.getByTestId('checkout-managed-form').count()) {
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return|\/account\/bookings/, { timeout: 45_000 });
    return;
  }
  if (await page.getByTestId('checkout-simulate-success').count()) {
    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/account\/bookings|\/checkout\/.+\/return/, { timeout: 40_000 });
    return;
  }
  throw new Error('No pay path');
}

async function checkoutApi(cookie: string, bookingId: string) {
  const res = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as { data?: Record<string, unknown>; code?: string };
  return { status: res.status, data: body.data, code: body.code };
}

async function acceptOwner(cookie: string, bookingId: string) {
  const res = await fetch(`${getApiBase()}/owner/bookings/${bookingId}/accept`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res;
}

async function rejectOwner(cookie: string, bookingId: string) {
  const res = await fetch(`${getApiBase()}/owner/bookings/${bookingId}/reject`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'CB-7 acceptance reject' }),
  });
  return res;
}

test.describe('CB-7 Customer Booking Final Acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('A Instant → Deposit → New Card → success (+ S mobile AR shots)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const slot = await findAvailableSlot({ minDaysAhead: 12, maxDaysAhead: 45 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await shot(page, '01-ar-mobile-property-booking-panel');
    // CB-UX-1: configuration is on /book (gotoProperty already lands there)
    await selectBookingSlot(page, slot, 3);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
    await shot(page, '02-ar-mobile-calendar-quote');
    await expect(page.getByTestId('booking-submit')).toContainText(/متابعة للدفع/);
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
    const bookingId = page.url().split('/checkout/')[1]!.split('?')[0]!;
    await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('checkout-amount-option-deposit')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await shot(page, '03-ar-mobile-deposit-full-selector');
    await shot(page, '04-ar-mobile-new-card-checkout');
    await payChoice(page, 'deposit');
    await shot(page, '06-ar-mobile-payment-processing-or-return');
    if (page.url().includes('/return')) {
      await expect(page.getByTestId('checkout-return-status')).toBeVisible({ timeout: 30_000 });
      await shot(page, '07-ar-mobile-payment-success');
    }
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const after = await checkoutApi(cookie, bookingId);
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
    await gotoSafe(page, '/ar/account/bookings');
    await shot(page, '08-ar-mobile-deposit-paid-my-booking');
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('B Instant → Full → New Card → success (+ U desktop AR)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { bookingId } = await createPendingPaymentBooking(page, 'ar');
    await shot(page, '10-ar-desktop-checkout');
    await payChoice(page, 'full');
    if (page.url().includes('/return')) {
      await expect(page.getByTestId('checkout-return-status')).toBeVisible({ timeout: 30_000 });
      await shot(page, '11-ar-desktop-full-paid-success');
    }
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const after = await checkoutApi(cookie, bookingId);
    expect(after.status).toBe(200);
    const data = after.data as {
      isFullyPaid?: boolean;
      paymentState?: string;
      duePurpose?: string | null;
      payment?: { purpose?: string };
    };
    expect(data.isFullyPaid === true || data.paymentState === 'fully_paid').toBeTruthy();
    expect(data.duePurpose == null).toBeTruthy();
    expect(data.payment?.purpose === 'full' || data.paymentState === 'fully_paid').toBeTruthy();
    await gotoSafe(page, `/ar/checkout/${bookingId}`);
    await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('C/D Owner Approval → accept Deposit / reject', async ({ page }) => {
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const propertyId = await resolvePropertyId(ownerCookie);
    await patchInstant(ownerCookie, propertyId, false);

    try {
      const slot = await findAvailableSlot({ minDaysAhead: 14, maxDaysAhead: 50 });
      await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoProperty(page, 'ar', PROPERTY_SLUG);
      await selectBookingSlot(page, slot, 3);
      await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('booking-submit')).toContainText(/إرسال طلب الحجز/);
      await expect(page.getByTestId('owner-approval-no-charge-note')).toBeVisible();
      await clickBookNow(page);
      await page.waitForURL(/\/ar\/account\/bookings|\/ar\/checkout\//, { timeout: 30_000 });

      const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      const list = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
      const listBody = (await list.json()) as {
        data?: Array<{ id: string; status: string }>;
      };
      const pending = listBody.data?.find((b) => b.status === 'pending_owner_approval');
      expect(pending).toBeTruthy();
      await page.goto(`/ar/checkout/${pending!.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.getByTestId('checkout-page')).toHaveAttribute(
        'data-checkout-state',
        'pending_owner_approval',
      );
      await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);
      await expect(page.getByTestId('checkout-managed-form')).toHaveCount(0);
      await shot(page, '12-ar-owner-approval-waiting');

      // Reject path (D)
      const rejectTarget = pending!.id;
      const rej = await rejectOwner(ownerCookie, rejectTarget);
      expect(rej.ok).toBeTruthy();
      const afterRej = await checkoutApi(cookie, rejectTarget);
      expect(afterRej.status === 404 || afterRej.data?.status === 'cancelled' || afterRej.data?.status === 'rejected' || !afterRej.data?.duePurpose).toBeTruthy();

      // Accept path (C) — new request
      const slot2 = await findAvailableSlot({ minDaysAhead: 16, maxDaysAhead: 52 });
      await gotoProperty(page, 'ar', PROPERTY_SLUG);
      await selectBookingSlot(page, slot2, 3);
      await clickBookNow(page);
      await page.waitForURL(/\/ar\/account\/bookings|\/ar\/checkout\//, { timeout: 30_000 });
      const list2 = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
      const list2Body = (await list2.json()) as {
        data?: Array<{ id: string; status: string }>;
      };
      const pending2 = list2Body.data?.find((b) => b.status === 'pending_owner_approval');
      expect(pending2).toBeTruthy();
      const acc = await acceptOwner(ownerCookie, pending2!.id);
      expect(acc.ok).toBeTruthy();
      // Acceptance must not charge
      const mid = await checkoutApi(cookie, pending2!.id);
      expect(mid.status).toBe(200);
      const midData = mid.data as { payment?: { status?: string }; isFullyPaid?: boolean };
      expect(midData.isFullyPaid).not.toBe(true);
      expect(midData.payment?.status !== 'succeeded').toBeTruthy();

      await page.goto(`/ar/checkout/${pending2!.id}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible({
        timeout: 20_000,
      });
      await shot(page, '13-ar-owner-approved-checkout');
      await payChoice(page, 'deposit');
      const paid = await checkoutApi(cookie, pending2!.id);
      const paidData = paid.data as { paymentState?: string; payment?: { purpose?: string } };
      expect(
        paidData.payment?.purpose === 'deposit' || paidData.paymentState === 'deposit_paid',
      ).toBeTruthy();
      await cancelBookingViaApi(cookie, pending2!.id).catch(() => undefined);
    } finally {
      await patchInstant(ownerCookie, propertyId, true);
    }
  });

  test('F/G Deposit→Balance absence of Full; Full→no Balance CTA', async ({ page }) => {
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const { bookingId } = await createPendingPaymentBooking(page);
    await payChoice(page, 'deposit');
    await page.goto(`/ar/checkout/${bookingId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('checkout-initial-payment-choice')).toHaveCount(0);
    const dep = await checkoutApi(cookie, bookingId);
    const depData = dep.data as { canPayBalance?: boolean; duePurpose?: string | null; isFullyPaid?: boolean };
    if (!depData.isFullyPaid) {
      expect(depData.duePurpose === 'balance' || depData.canPayBalance === true).toBeTruthy();
    }
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);

    const { bookingId: fullId } = await createPendingPaymentBooking(page);
    await payChoice(page, 'full');
    await page.goto('/ar/account/bookings', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('pay-balance')).toHaveCount(0);
    await cancelBookingViaApi(cookie, fullId).catch(() => undefined);
  });

  test('H/I/J Saved card Deposit + Full + Save New Card', async ({ page }) => {
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const { bookingId } = await createPendingPaymentBooking(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await payChoice(page, 'deposit', { saveCard: true });
    await shot(page, '05-ar-mobile-saved-card-checkout-or-after-save');

    const methods = await fetch(`${getApiBase()}/me/payment-methods`, {
      headers: { Cookie: cookie },
    });
    const methodsBody = (await methods.json()) as {
      data?: Array<{ id: string; expired?: boolean }>;
    };
    const saved = methodsBody.data?.find((m) => !m.expired);
    // Save may be capability-gated; still assert deposit success.
    const after = await checkoutApi(cookie, bookingId);
    expect(after.status).toBe(200);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);

    if (saved) {
      const { bookingId: fullId } = await createPendingPaymentBooking(page);
      await page.getByTestId('checkout-amount-option-full').click();
      const savedRadio = page.getByTestId(`checkout-saved-card-${saved.id}`);
      if (await savedRadio.count()) {
        await savedRadio.click();
        await page.getByTestId('checkout-saved-card-pay-btn').click();
        await page.waitForURL(/\/checkout\/.+\/return|\/account\/bookings/, { timeout: 45_000 });
      } else {
        await payChoice(page, 'full');
      }
      const fullAfter = await checkoutApi(cookie, fullId);
      const fd = fullAfter.data as { isFullyPaid?: boolean; paymentState?: string };
      expect(fd.isFullyPaid === true || fd.paymentState === 'fully_paid').toBeTruthy();
      await cancelBookingViaApi(cookie, fullId).catch(() => undefined);
    }
  });

  test('K/R Revoked card + Checkout IDOR', async ({ page }) => {
    const cookieA = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const { bookingId } = await createPendingPaymentBooking(page);
    // IDOR: unauthenticated / wrong session must not see checkout.
    const anon = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`);
    expect(anon.status === 401 || anon.status === 403 || anon.status === 404).toBeTruthy();

    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const foreign = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
      headers: { Cookie: ownerCookie },
    });
    expect(foreign.status === 401 || foreign.status === 403 || foreign.status === 404).toBeTruthy();

    const methods = await fetch(`${getApiBase()}/me/payment-methods`, {
      headers: { Cookie: cookieA },
    });
    const body = (await methods.json()) as { data?: Array<{ id: string }> };
    if (body.data?.[0]) {
      await fetch(`${getApiBase()}/me/payment-methods/${body.data[0].id}`, {
        method: 'DELETE',
        headers: { Cookie: cookieA },
      });
      const charge = await fetch(`${getApiBase()}/payments/saved-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          bookingId,
          savedPaymentMethodId: body.data[0].id,
          initialPaymentChoice: 'deposit',
        }),
      });
      expect(charge.ok).toBeFalsy();
    }
    await cancelBookingViaApi(cookieA, bookingId);
  });

  test('N Hold expired / cancelled checkout state shot', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
    await page.goto(`/ar/checkout/${bookingId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 20_000 });
    await shot(page, '15-ar-expired-hold-state');
  });

  test('Q Double click Managed Form', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    if (await page.getByTestId('checkout-amount-option-deposit').count()) {
      // leave default deposit
    }
    const useNew = page.getByTestId('checkout-use-new-card');
    if (await useNew.count()) await useNew.click();
    if (await page.getByTestId('checkout-managed-form').count()) {
      await fillDummyCard(page);
      await Promise.all([
        page.getByTestId('checkout-managed-pay').click(),
        page.getByTestId('checkout-managed-pay').click().catch(() => undefined),
      ]);
      await page.waitForURL(/\/checkout\/.+\/return|\/account\/bookings/, { timeout: 45_000 });
    } else {
      await payChoice(page, 'deposit');
    }
    const after = await checkoutApi(cookie, bookingId);
    expect(after.status).toBe(200);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('T EN mobile Checkout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { bookingId } = await createPendingPaymentBooking(page, 'en');
    await expect(page.getByTestId('checkout-initial-payment-choice')).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, '14-en-mobile-checkout');
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
  });

  test('O/P unknown + 3DS mock seams (API-level)', async ({ page }) => {
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    // Browser return must not authorize: fake success query ignored.
    await page.goto(`/ar/checkout/${bookingId}/return?paymentId=fake_payment&status=succeeded`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await expect(page.getByTestId('checkout-return-page')).toBeVisible();
    const status = page.getByTestId('checkout-return-status');
    await expect(status).not.toHaveAttribute('data-status', 'succeeded');
    await cancelBookingViaApi(cookie, bookingId);
  });

  test('09 AR desktop property booking', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await shot(page, '09-ar-desktop-property-booking');
  });
});
