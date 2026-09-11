import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  PROPERTY_SLUG,
  SLOT_UNAVAILABLE_AR,
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
  selectCalendarDate,
} from './helpers/booking-ui.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';
import { applySessionToPage } from './helpers/session.js';

function plusDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function patchInstant(cookie: string, propertyId: string, enabled: boolean) {
  const res = await fetch(`${getApiBase()}/owner/properties/${propertyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ instantBookingEnabled: enabled }),
  });
  expect(res.ok).toBeTruthy();
}

test.describe('CB-1 booking calendar — AR mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('calendar month nav, select date/period, guests, one range fetch', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);

    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.getByTestId('booking-period-empty-hint')).toBeVisible();
    await expect(page.getByTestId('booking-cancellation-policy-link')).toBeVisible();
    await expect(page.getByText(/7 أيام قبل الوصول/)).toHaveCount(0);

    const reqUrls: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'GET' && req.url().includes('/availability')) {
        reqUrls.push(req.url());
      }
    });

    await page.getByTestId('booking-date-trigger').click();
    await expect(page.getByTestId('booking-calendar-dialog')).toBeVisible();
    await expect(page.getByTestId('booking-calendar-sheet')).toBeVisible();
    await expect(page.getByTestId('booking-calendar-prev')).toBeDisabled();
    await expect(page.getByTestId('booking-calendar-grid')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('booking-calendar-next').click();
    await expect(page.getByTestId('booking-calendar-prev')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('booking-calendar-prev').click();
    await expect(page.getByTestId('booking-calendar-prev')).toBeDisabled({ timeout: 15_000 });

    await page.getByTestId('booking-calendar-close').click();
    await expect(page.getByTestId('booking-calendar-dialog')).toHaveCount(0);

    const slot = await findAvailableSlot({ minDaysAhead: 5, maxDaysAhead: 25 });
    await selectBookingSlot(page, slot, 3);
    await expect(page.getByTestId(`booking-period-${slot.period}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('booking-guests')).toHaveValue('3');
    await expect(page.getByTestId('booking-guests-decrease')).toBeEnabled();

    const monthFetches = reqUrls.filter((u) =>
      u.includes(`/properties/${PROPERTY_SLUG}/availability`),
    );
    expect(monthFetches.length).toBeGreaterThan(0);
    expect(monthFetches.every((u) => /from=\d{4}-\d{2}-\d{2}/.test(u))).toBeTruthy();
    expect(monthFetches.length).toBeLessThan(12);

    await page.screenshot({
      path: 'test-results/cb1-ar-mobile-booking-panel.png',
      fullPage: true,
    });
  });
});

test.describe('CB-1 booking calendar — AR desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop calendar modal + panel', async ({ page }) => {
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await page.getByTestId('booking-date-trigger').click();
    await expect(page.getByTestId('booking-calendar-dialog')).toBeVisible();
    await expect(page.getByTestId('booking-calendar-sheet')).toBeVisible();
    await page.screenshot({ path: 'test-results/cb1-ar-desktop-calendar.png' });
    await page.getByTestId('booking-calendar-close').click();
  });
});

test.describe('CB-1 booking calendar — EN mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('EN calendar + period selection', async ({ page }) => {
    await gotoProperty(page, 'en', PROPERTY_SLUG);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const slot = await findAvailableSlot({ minDaysAhead: 6, maxDaysAhead: 22 });
    await selectBookingSlot(page, slot, 2);
    await expect(page.getByTestId('booking-summary-price')).toBeVisible();
    await page.screenshot({ path: 'test-results/cb1-en-mobile-selected.png' });
  });
});

test.describe('CB-1 booking create regressions', () => {
  test('instant booking create → checkout without payment', async ({ page }) => {
    test.setTimeout(120_000);
    const slot = await findAvailableSlot({ minDaysAhead: 8, maxDaysAhead: 28 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, 4);
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
    await expect(page.getByTestId('checkout-page')).toBeVisible();
  });

  test('owner-approval create → my bookings', async ({ page }) => {
    test.setTimeout(150_000);
    const fixtures = new TestPropertyFixtureTracker();
    const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    let propertyId = '';
    try {
      const prop = await createAndPublishTestProperty({
        titleEn: `CB1 OA ${Date.now()}`,
        area: 'e2e-cb1-oa',
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
      await expect(page.getByTestId('owner-approval-no-charge-note')).toBeVisible();
      await selectBookingSlot(page, slot, 2);
      await clickBookNow(page);
      await page.waitForURL(/\/ar\/account\/bookings/, { timeout: 30_000 });
    } finally {
      if (propertyId) {
        await patchInstant(owner, propertyId, true).catch(() => undefined);
      }
      await fixtures.dispose();
    }
  });

  test('stale slot rejected with refresh message', async ({ browser }) => {
    test.setTimeout(120_000);
    const slot = await findAvailableSlot({ minDaysAhead: 40, maxDaysAhead: 70 });
    const cookie = await loginViaApi();
    const context = await browser.newContext();
    let heldId: string | null = null;
    try {
      const pageA = await context.newPage();
      const pageB = await context.newPage();
      await applySessionToPage(pageA, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await applySessionToPage(pageB, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await gotoProperty(pageA, 'ar', PROPERTY_SLUG);
      await gotoProperty(pageB, 'ar', PROPERTY_SLUG);
      await selectBookingSlot(pageA, slot, 2);
      await selectBookingSlot(pageB, slot, 2);

      const bookB = pageB.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
      );
      await clickBookNow(pageB);
      const resB = await bookB;
      expect(resB.status()).toBe(201);
      heldId = ((await resB.json()) as { data?: { id?: string } }).data?.id ?? null;

      const conflict = pageA.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
      );
      await clickBookNow(pageA);
      expect((await conflict).status()).toBe(409);
      await expect(pageA.getByTestId('booking-error')).toContainText(SLOT_UNAVAILABLE_AR, {
        timeout: 20_000,
      });
    } finally {
      if (heldId) await cancelBookingViaApi(cookie, heldId);
      await context.close();
    }
  });

  test('calendar selection creates no booking/hold', async ({ page }) => {
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const before = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
    const beforeBody = (await before.json()) as { data?: unknown[] };
    const beforeCount = beforeBody.data?.length ?? 0;

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 9, maxDaysAhead: 30 });
    await selectCalendarDate(page, slot.date);
    await page.getByTestId('booking-date-trigger').click();
    await page.getByTestId('booking-calendar-close').click();
    await page.getByTestId('booking-guests-increase').click();

    const after = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
    const afterBody = (await after.json()) as { data?: unknown[] };
    expect(afterBody.data?.length ?? 0).toBe(beforeCount);
  });

  test('favorite still present on booking panel', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await expect(page.getByTestId('booking-panel').getByTestId('favorite-toggle')).toBeVisible();
  });
});

test.describe('CB-1 full_day / overnight periods', () => {
  test('period cards render when deep-linked', async ({ page }) => {
    const from = plusDays(3);
    const to = plusDays(50);
    const res = await fetch(
      `${getApiBase()}/properties/${PROPERTY_SLUG}/availability?from=${from}&to=${to}`,
    );
    const body = (await res.json()) as {
      data: Array<{ date: string; period: string; bookable?: boolean; status: string }>;
    };
    const full = body.data.find(
      (s) => s.period === 'full_day' && (s.bookable === true || s.status === 'available'),
    );
    const overnight = body.data.find(
      (s) => s.period === 'overnight' && (s.bookable === true || s.status === 'available'),
    );

    if (full) {
      await page.goto(`/ar/properties/${PROPERTY_SLUG}/book?date=${full.date}&period=full_day`);
      await expect(page.getByTestId('booking-period-full_day')).toBeVisible({ timeout: 25_000 });
      await page.screenshot({ path: 'test-results/cb1-full-day-period.png' });
    } else {
      test.info().annotations.push({ type: 'note', description: 'no full_day slot in window' });
    }

    if (overnight) {
      await page.goto(`/ar/properties/${PROPERTY_SLUG}/book?date=${overnight.date}&period=overnight`);
      await expect(page.getByTestId('booking-period-overnight')).toBeVisible({ timeout: 25_000 });
      await page.screenshot({ path: 'test-results/cb1-overnight-period.png' });
    } else {
      test.info().annotations.push({ type: 'note', description: 'no overnight slot in window' });
    }
  });
});
