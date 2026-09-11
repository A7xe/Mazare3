import { test, expect } from '@playwright/test';
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
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';
import { applySessionToPage } from './helpers/session.js';

async function patchInstant(cookie: string, propertyId: string, enabled: boolean) {
  const res = await fetch(`${getApiBase()}/owner/properties/${propertyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ instantBookingEnabled: enabled }),
  });
  expect(res.ok).toBeTruthy();
}

async function createPendingPaymentBooking(page: import('@playwright/test').Page) {
  const slot = await findAvailableSlot({ minDaysAhead: 8, maxDaysAhead: 35 });
  await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  await gotoProperty(page, 'ar', PROPERTY_SLUG);
  await selectBookingSlot(page, slot, 3);
  await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
  await clickBookNow(page);
  await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
  await expect(page.getByTestId('checkout-page')).toBeVisible();
  const bookingId = page.url().split('/checkout/')[1]?.split('?')[0];
  expect(bookingId).toBeTruthy();
  return { bookingId: bookingId!, slot };
}

test.describe('CB-3 native checkout — AR mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('instant booking → native deposit checkout', async ({ page }) => {
    test.setTimeout(120_000);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByRole('heading', { name: /إتمام الدفع/ })).toBeVisible();
    await expect(page.getByTestId('checkout-property-summary')).toBeVisible();
    await expect(page.getByTestId('checkout-approximate-location')).toBeVisible();
    await expect(page.getByTestId('checkout-booking-details')).toBeVisible();
    await expect(page.getByTestId('checkout-payment-summary')).toBeVisible();
    await expect(page.getByTestId('checkout-deposit-badge')).toBeVisible();
    await expect(page.getByTestId('checkout-due-now')).toBeVisible();
    await expect(page.getByTestId('checkout-payment-method')).toBeVisible();
    // CB-4 E2E runtime uses managed_form mock; HPP copy may be absent — assert PCI-safe fields.
    const managed = page.getByTestId('checkout-managed-form');
    if (await managed.count()) {
      await expect(managed).toBeVisible();
      await expect(page.locator('input[name="number"], input[name="cvv"], input[name="cardNumber"]')).toHaveCount(0);
      await expect(page.locator('[data-paylib="number"]')).toHaveCount(1);
    } else {
      await expect(page.getByText(/بطاقة بنكية|الدفع بالبطاقة/)).toBeVisible();
      await expect(page.locator('input[name="cardNumber"], input[autocomplete="cc-number"]')).toHaveCount(0);
    }
    await expect(page.getByText(/الضريبة|VAT|عمولة المنصة/i)).toHaveCount(0);
    await expect(page.getByTestId('checkout-simulate-success')).toBeVisible();
    await page.screenshot({ path: 'test-results/cb3-ar-mobile-deposit.png', fullPage: true });

    // cleanup hold
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
  });
});

test.describe('CB-3 native checkout — AR desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop deposit checkout layout', async ({ page }) => {
    test.setTimeout(120_000);
    const { bookingId } = await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-payment-summary')).toBeVisible();
    await expect(page.getByTestId('checkout-hold-banner')).toBeVisible();
    await page.screenshot({ path: 'test-results/cb3-ar-desktop-deposit.png' });
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
  });
});

test.describe('CB-3 native checkout — EN mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('EN checkout labels', async ({ page }) => {
    test.setTimeout(120_000);
    const slot = await findAvailableSlot({ minDaysAhead: 9, maxDaysAhead: 36 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'en', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, 2);
    await clickBookNow(page);
    await page.waitForURL(/\/en\/checkout\//, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Complete payment/i })).toBeVisible();
    const method = page.getByTestId('checkout-payment-method');
    await expect(method).toBeVisible();
    await expect(page.getByText(/Bank card|Pay by card/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/cb3-en-mobile-checkout.png' });
    const bookingId = page.url().split('/checkout/')[1]?.split('?')[0]!;
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
  });
});

test.describe('CB-3 checkout states', () => {
  test('pending_owner_approval shows waiting, no pay', async ({ page }) => {
    test.setTimeout(150_000);
    const fixtures = new TestPropertyFixtureTracker();
    const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    let propertyId = '';
    let bookingId = '';
    try {
      const prop = await createAndPublishTestProperty({
        titleEn: `CB3 OA ${Date.now()}`,
        area: 'e2e-cb3-oa',
      });
      propertyId = prop.id;
      fixtures.track(prop.id);
      await patchInstant(owner, prop.id, false);

      const slot = await findAvailableSlot({
        slug: prop.slug,
        minDaysAhead: 5,
        maxDaysAhead: 40,
      });
      await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await gotoProperty(page, 'ar', prop.slug);
      await selectBookingSlot(page, slot, 2);
      await clickBookNow(page);
      await page.waitForURL(/\/ar\/account\/bookings/, { timeout: 30_000 });

      const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      const list = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
      const body = (await list.json()) as { data: Array<{ id: string; status: string }> };
      const pending = body.data.find((b) => b.status === 'pending_owner_approval');
      expect(pending).toBeTruthy();
      bookingId = pending!.id;

      await page.goto(`/ar/checkout/${bookingId}`);
      await expect(page.getByTestId('checkout-page')).toHaveAttribute(
        'data-checkout-state',
        'pending_owner_approval',
      );
      await expect(page.getByText(/بانتظار موافقة صاحب المزرعة/)).toBeVisible();
      await expect(page.getByTestId('checkout-simulate-success')).toHaveCount(0);
      await expect(page.getByTestId('checkout-paytabs-pay')).toHaveCount(0);
      await page.screenshot({ path: 'test-results/cb3-ar-owner-approval.png' });
    } finally {
      if (bookingId) {
        const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
        await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
      }
      if (propertyId) await patchInstant(owner, propertyId, true).catch(() => undefined);
      await fixtures.dispose();
    }
  });

  test('IDOR: other customer cannot load checkout', async ({ browser }) => {
    test.setTimeout(120_000);
    const pageA = await browser.newPage();
    const { bookingId } = await createPendingPaymentBooking(pageA);
    await pageA.close();

    // Use a second customer session if available; otherwise owner must not see customer checkout
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const res = await fetch(`${getApiBase()}/me/bookings/${bookingId}/checkout`, {
      headers: { Cookie: ownerCookie },
    });
    expect([401, 403, 404]).toContain(res.status);

    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await cancelBookingViaApi(cookie, bookingId);
  });

  test('hold expiry removes pay path', async ({ page }) => {
    test.setTimeout(120_000);
    const { bookingId } = await createPendingPaymentBooking(page);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    const backdate = await fetch(`${getApiBase()}/internal/bookings/${bookingId}/backdate-hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(backdate.ok).toBeTruthy();

    await page.reload();
    await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 20_000 });
    const expiredUi =
      (await page.getByTestId('checkout-hold-expired').count()) > 0 ||
      (await page.getByTestId('checkout-page').getAttribute('data-checkout-state')) === 'expired' ||
      (await page.getByText(/انتهت مهلة إكمال الدفع/).count()) > 0;
    expect(expiredUi).toBeTruthy();
    await expect(page.getByTestId('checkout-simulate-success')).toHaveCount(0);

    await cancelBookingViaApi(cookie, bookingId).catch(() => undefined);
  });

  test('simulate success still works on native checkout', async ({ page }) => {
    test.setTimeout(120_000);
    await createPendingPaymentBooking(page);
    await expect(page.getByTestId('checkout-simulate-success')).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/ar\/account\/bookings/, { timeout: 30_000 });
  });
});
