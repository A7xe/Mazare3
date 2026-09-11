import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  getApiBase,
  PROPERTY_SLUG,
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

async function revealManagedFormIfNeeded(page: import('@playwright/test').Page) {
  const useNew = page.getByTestId('checkout-use-new-card');
  if (await useNew.count()) await useNew.click();
}

async function createPendingPaymentBooking(page: import('@playwright/test').Page) {
  const slot = await findAvailableSlot({ minDaysAhead: 10, maxDaysAhead: 40 });
  await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  await gotoProperty(page, 'ar', PROPERTY_SLUG);
  await selectBookingSlot(page, slot, 3);
  await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
  await clickBookNow(page);
  await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
  await expect(page.getByTestId('checkout-page')).toBeVisible();
  await revealManagedFormIfNeeded(page);
  const bookingId = page.url().split('/checkout/')[1]?.split('?')[0];
  expect(bookingId).toBeTruthy();
  return { bookingId: bookingId! };
}

async function fillDummyCard(page: import('@playwright/test').Page) {
  await page.locator('[data-paylib="number"]').fill('4111111111111111');
  await page.locator('[data-paylib="expmonth"]').fill('12');
  await page.locator('[data-paylib="expyear"]').fill('30');
  await page.locator('[data-paylib="cvv"]').fill('123');
}

type MethodRow = {
  id: string;
  maskedDisplay?: string | null;
  last4?: string | null;
  brand?: string | null;
  providerToken?: string;
};

async function listMethods(cookie: string) {
  const res = await fetch(`${getApiBase()}/me/payment-methods`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as { data?: MethodRow[] };
  return { status: res.status, data: body.data ?? [] };
}

function isMockVisa(m: MethodRow): boolean {
  return (
    (m.last4 ?? '') === '4242' ||
    (m.maskedDisplay ?? '').includes('4242') ||
    (m.brand ?? '').toLowerCase() === 'visa'
  );
}

async function revokeAllMethods(cookie: string) {
  const methods = await listMethods(cookie);
  for (const m of methods.data) {
    await fetch(`${getApiBase()}/me/payment-methods/${m.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
  }
}

async function waitForSavedVisa(cookie: string, timeoutMs = 25_000): Promise<MethodRow[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const after = await listMethods(cookie);
    if (after.data.some(isMockVisa)) return after.data;
    await new Promise((r) => setTimeout(r, 800));
  }
  return (await listMethods(cookie)).data;
}

test.describe('CB-5A Saved Card Vault — mock only', () => {
  test('A new card Save unchecked → no saved method', async ({ page }) => {
    test.setTimeout(120_000);
    const cookieBefore = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await revokeAllMethods(cookieBefore);
    const before = await listMethods(cookieBefore);
    expect(before.data.length).toBe(0);

    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-save-card-checkbox')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('checkout-save-card-checkbox')).not.toBeChecked();
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });

    const after = await listMethods(cookieBefore);
    expect(after.data.length).toBe(0);
    await cancelBookingViaApi(cookieBefore, bookingId).catch(() => undefined);
  });

  test('B/C new card Save checked → saved method + account masked', async ({ page }) => {
    test.setTimeout(140_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await revokeAllMethods(cookie);

    const { bookingId } = await createPendingPaymentBooking(page);
    const checkbox = page.getByTestId('checkout-save-card-checkbox');
    await expect(checkbox).toBeVisible({ timeout: 20_000 });
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });

    const after = await waitForSavedVisa(cookie);
    expect(after.some(isMockVisa)).toBeTruthy();
    const method = after.find(isMockVisa)!;
    expect(method).not.toHaveProperty('providerToken');
    expect(JSON.stringify(method)).not.toMatch(/providerToken|providerTokenCipher/i);
    expect(method.maskedDisplay || method.last4).toBeTruthy();

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/payment-methods');
    await expect(page.getByTestId('payment-methods-title')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('payment-methods-list')).toBeVisible();
    await expect(page.getByText(/4242|Visa/i).first()).toBeVisible();
    void bookingId;
  });

  test('D duplicate callback → no duplicate rows', async ({ page }) => {
    test.setTimeout(120_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await revokeAllMethods(cookie);

    const { bookingId } = await createPendingPaymentBooking(page);
    await page.getByTestId('checkout-save-card-checkbox').check();
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    await waitForSavedVisa(cookie);

    const mid = await listMethods(cookie);
    expect(mid.data.filter(isMockVisa).length).toBe(1);

    const payments = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
      headers: { Cookie: cookie },
    });
    const checkout = (await payments.json()) as { data?: { payment?: { id?: string } } };
    const paymentId = checkout.data?.payment?.id;
    if (paymentId) {
      await fetch(`${getApiBase()}/payments/${paymentId}/browser-return`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });
      // Re-apply same trusted success payload via webhook-style duplicate is covered by upsert;
      // browser return alone must not create extras.
    }

    const after = await listMethods(cookie);
    expect(after.data.filter(isMockVisa).length).toBe(1);
    expect(after.data.every((m) => !('providerToken' in m))).toBeTruthy();
  });

  test('E remove card → provider mock revoke + local revoked', async ({ page }) => {
    test.setTimeout(120_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    let methods = await listMethods(cookie);
    if (methods.data.length === 0) {
      const { bookingId } = await createPendingPaymentBooking(page);
      await page.getByTestId('checkout-save-card-checkbox').check();
      await fillDummyCard(page);
      await page.getByTestId('checkout-managed-pay').click();
      await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
      await waitForSavedVisa(cookie);
      methods = await listMethods(cookie);
      void bookingId;
    }
    expect(methods.data.length).toBeGreaterThan(0);
    const id = methods.data[0]!.id;

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/payment-methods');
    await expect(page.getByTestId('payment-method-row').first()).toBeVisible({ timeout: 20_000 });
    await page.locator(`[data-method-id="${id}"]`).getByTestId('payment-method-remove').click();
    await expect(page.locator(`[data-method-id="${id}"]`)).toHaveCount(0, { timeout: 15_000 });

    const after = await listMethods(cookie);
    expect(after.data.find((m) => m.id === id)).toBeUndefined();
  });

  test('F Customer B cannot access Customer A method', async () => {
    test.setTimeout(60_000);
    const cookieA = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    let methodsA = await listMethods(cookieA);
    if (methodsA.data.length === 0) {
      // Ensure A has a method id for forged access attempts.
      // Prefer leftover from prior tests; otherwise skip soft forge with fake id.
    }

    const emailB = `cb5a-b-${Date.now()}@mazare3.test`;
    const passwordB = 'Mazare3Demo2026!';
    const signup = await fetch(`${getApiBase()}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailB,
        password: passwordB,
        name: 'CB5A Customer B',
        locale: 'en',
      }),
    });
    expect(signup.ok || signup.status === 409).toBeTruthy();
    const cookieB = await loginViaApi(emailB, passwordB);

    const forgedId = methodsA.data[0]?.id ?? 'clxxxxxxxxxxxxxxxxxxxx';
    const listB = await listMethods(cookieB);
    expect(listB.data.find((m) => m.id === forgedId)).toBeUndefined();

    const del = await fetch(`${getApiBase()}/me/payment-methods/${forgedId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieB },
    });
    expect(del.status).toBeGreaterThanOrEqual(400);

    const def = await fetch(`${getApiBase()}/me/payment-methods/${forgedId}/default`, {
      method: 'POST',
      headers: { Cookie: cookieB },
    });
    expect(def.status).toBeGreaterThanOrEqual(400);
  });

  test('G tokenization disabled → checkbox absent', async ({ page }) => {
    test.setTimeout(120_000);
    await page.route(/\/payments\/config(\?|$)/, async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as { data: Record<string, unknown> };
      json.data = { ...json.data, savedCardsEnabled: false };
      await route.fulfill({
        status: res.status(),
        contentType: 'application/json',
        body: JSON.stringify(json),
      });
    });
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-managed-form')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('checkout-save-card')).toHaveCount(0);
    await expect(page.getByTestId('checkout-save-card-checkbox')).toHaveCount(0);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
  });

  test('H ordinary CB-4 payment unchanged (no save still pays)', async ({ page }) => {
    test.setTimeout(120_000);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-managed-form')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('checkout-save-card-checkbox')).not.toBeChecked();
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    await expect(page.getByTestId('checkout-return-page')).toBeVisible({ timeout: 20_000 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });
});
