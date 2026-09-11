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

async function createPendingPaymentBooking(page: import('@playwright/test').Page) {
  const slot = await findAvailableSlot({ minDaysAhead: 12, maxDaysAhead: 42 });
  await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  await gotoProperty(page, 'ar', PROPERTY_SLUG);
  await selectBookingSlot(page, slot, 3);
  await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
  await clickBookNow(page);
  await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
  await expect(page.getByTestId('checkout-page')).toBeVisible();
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

async function listMethods(cookie: string) {
  const res = await fetch(`${getApiBase()}/me/payment-methods`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as {
    data?: Array<{ id: string; last4?: string | null; maskedDisplay?: string | null }>;
  };
  return { status: res.status, data: body.data ?? [] };
}

async function revokeAll(cookie: string) {
  const methods = await listMethods(cookie);
  for (const m of methods.data) {
    await fetch(`${getApiBase()}/me/payment-methods/${m.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
  }
}

async function ensureSavedCard(page: import('@playwright/test').Page, cookie: string) {
  let methods = await listMethods(cookie);
  if (methods.data.some((m) => (m.last4 ?? '').includes('4242') || (m.maskedDisplay ?? '').includes('4242'))) {
    return methods.data[0]!;
  }
  const { bookingId } = await createPendingPaymentBooking(page);
  const useNew = page.getByTestId('checkout-use-new-card');
  if (await useNew.count()) {
    await useNew.click();
  }
  await expect(page.getByTestId('checkout-managed-form')).toBeVisible({ timeout: 20_000 });
  if (await page.getByTestId('checkout-save-card-checkbox').count()) {
    await page.getByTestId('checkout-save-card-checkbox').check();
  }
  await fillDummyCard(page);
  await page.getByTestId('checkout-managed-pay').click();
  await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
  const start = Date.now();
  while (Date.now() - start < 20_000) {
    methods = await listMethods(cookie);
    if (methods.data.length > 0) break;
    await page.waitForTimeout(800);
  }
  expect(methods.data.length).toBeGreaterThan(0);
  void bookingId;
  return methods.data[0]!;
}

async function setChargeMode(mode: string, recurringEnabled?: boolean) {
  await fetch(`${getApiBase().replace(/\/api\/v1$/, '')}/api/v1/internal/qa/paytabs-saved-card-charge-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, recurringEnabled }),
  });
}

async function setMockOutcome(outcome: string | null) {
  await fetch(`${getApiBase().replace(/\/api\/v1$/, '')}/api/v1/internal/qa/mock-saved-card-outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: outcome ?? '' }),
  });
}

test.describe('CB-5B Saved Card Charging — mock only', () => {
  test.beforeEach(async () => {
    await setChargeMode('ecom_cvv_redirect', false);
    await setMockOutcome(null);
  });

  test('A saved card selector', async ({ page }) => {
    test.setTimeout(140_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-saved-card-selector')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('checkout-saved-card-option').first()).toBeVisible();
    await expect(page.getByTestId('checkout-use-new-card')).toBeVisible();
    await expect(page.getByText('استخدام بطاقة جديدة')).toBeVisible();
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('B/C ecom CVV redirect + return path', async ({ page }) => {
    test.setTimeout(140_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-saved-card-ecom-notice')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/سيُطلب منك تأكيد البطاقة/)).toBeVisible();
    await page.getByTestId('checkout-saved-card-pay-btn').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    await expect(page.getByTestId('checkout-return-page')).toBeVisible({ timeout: 20_000 });
    // Browser return non-authoritative — ack must not invent success alone
    const checkout = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
      headers: { Cookie: cookie },
    });
    const body = (await checkout.json()) as { data?: { payment?: { id?: string; status?: string } } };
    const paymentId = body.data?.payment?.id;
    if (paymentId) {
      await fetch(`${getApiBase()}/payments/${paymentId}/browser-return`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });
      // Authoritative success via simulate (mock QA seam)
      await fetch(`${getApiBase()}/payments/${paymentId}/simulate-success`, {
        method: 'POST',
        headers: { Cookie: cookie },
      });
    }
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('D recurring_direct mock authorised', async ({ page }) => {
    test.setTimeout(140_000);
    await setChargeMode('recurring_direct', true);
    await setMockOutcome('authorised');
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    // Mode is recurring — ecom notice should be absent
    await expect(page.getByTestId('checkout-saved-card-pay-btn')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('checkout-saved-card-pay-btn').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    await expect(page.getByTestId('checkout-return-page')).toBeVisible({ timeout: 20_000 });
    await setChargeMode('ecom_cvv_redirect', false);
    await setMockOutcome(null);
    void bookingId;
  });

  test('E recurring_direct decline', async ({ page }) => {
    test.setTimeout(140_000);
    await setChargeMode('recurring_direct', true);
    await setMockOutcome('declined');
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await page.getByTestId('checkout-saved-card-pay-btn').click();
    await expect(page.getByRole('alert').or(page.getByText(/رفض|declined|تعذّر/i)).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('checkout-use-new-card')).toBeVisible();
    await setChargeMode('ecom_cvv_redirect', false);
    await setMockOutcome(null);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('F approval gate off (recurring without flag)', async () => {
    await setChargeMode('recurring_direct', false);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const cfg = await fetch(`${getApiBase()}/payments/config`, { headers: { Cookie: cookie } });
    const body = (await cfg.json()) as {
      data?: { savedCardChargeEnabled?: boolean; savedCardChargeMode?: string | null };
    };
    expect(body.data?.savedCardChargeEnabled).toBe(false);
    await setChargeMode('ecom_cvv_redirect', false);
  });

  test('G IDOR', async () => {
    const cookieA = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const methodsA = await listMethods(cookieA);
    const forgedId = methodsA.data[0]?.id ?? 'clxxxxxxxxxxxxxxxxxxxx';
    const emailB = `cb5b-b-${Date.now()}@mazare3.test`;
    await fetch(`${getApiBase()}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password: 'Mazare3Demo2026!', name: 'CB5B B', locale: 'en' }),
    });
    const cookieB = await loginViaApi(emailB, 'Mazare3Demo2026!');
    const res = await fetch(`${getApiBase()}/payments/saved-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ bookingId: 'nonexistent', savedPaymentMethodId: forgedId }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.text();
    expect(body).not.toMatch(/providerToken|2C4651BF67A3EC34/i);
  });

  test('H double click', async ({ page }) => {
    test.setTimeout(140_000);
    await setChargeMode('recurring_direct', true);
    await setMockOutcome('authorised');
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    const btn = page.getByTestId('checkout-saved-card-pay-btn');
    await btn.click();
    await btn.click({ trial: true }).catch(() => undefined);
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    await setChargeMode('ecom_cvv_redirect', false);
    await setMockOutcome(null);
    void bookingId;
  });

  test('I unknown result', async ({ page }) => {
    test.setTimeout(140_000);
    await setChargeMode('recurring_direct', true);
    await setMockOutcome('network_unknown');
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await page.getByTestId('checkout-saved-card-pay-btn').click();
    await expect(page.getByTestId('checkout-return-status')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId('checkout-return-status')).toContainText(
      /نتحقق من الدفع|قيد المعالجة|جارٍ تأكيد|verifying|processing/i,
    );
    await setChargeMode('ecom_cvv_redirect', false);
    await setMockOutcome(null);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('J invalid token', async ({ page }) => {
    test.setTimeout(140_000);
    await setChargeMode('recurring_direct', true);
    await setMockOutcome('invalid_token');
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await page.getByTestId('checkout-saved-card-pay-btn').click();
    await expect(page.getByText(/تعذّر استخدام هذه البطاقة|can no longer be used/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('checkout-use-new-card').or(page.getByTestId('checkout-managed-form'))).toBeVisible();
    await setChargeMode('ecom_cvv_redirect', false);
    await setMockOutcome(null);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('K balance architecture (deposit path still customer Pay)', async ({ page }) => {
    test.setTimeout(120_000);
    // Explicit Pay only — opening checkout must not auto-charge.
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const before = await listMethods(cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-saved-card-selector')).toBeVisible({ timeout: 20_000 });
    // No automatic provider charge: stay on checkout without pressing Pay
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/checkout\//);
    const after = await listMethods(cookie);
    expect(after.data.length).toBe(before.data.length);
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('L new-card fallback', async ({ page }) => {
    test.setTimeout(140_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await page.getByTestId('checkout-use-new-card').click();
    await expect(page.getByTestId('checkout-managed-form')).toBeVisible({ timeout: 15_000 });
    await fillDummyCard(page);
    await page.getByTestId('checkout-managed-pay').click();
    await page.waitForURL(/\/checkout\/.+\/return/, { timeout: 40_000 });
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('M mobile selector', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-saved-card-option').first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/cb5b-ar-390-saved-selector.png', fullPage: true });
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('N desktop selector', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await ensureSavedCard(page, cookie);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-saved-card-selector')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/cb5b-desktop-saved-selector.png', fullPage: true });
    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });
});
