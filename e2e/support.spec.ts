import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  PROPERTY_SLUG,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { createBookingViaApi, findAvailableSlot, loginViaApi } from './helpers/api.js';

test.describe('Customer support and contact (10H.3B)', () => {
  test.describe.configure({ retries: 0 });

  test('public contact page remains accessible in Arabic and English', async ({ page }) => {
    await page.goto('/ar/contact');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('legal-page-contact')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('تواصل معنا');
    await expect(page.getByTestId('contact-support-form')).toBeVisible();
    await expect(page.getByTestId('contact-support-name')).toBeVisible();

    await page.goto('/en/contact');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact us');
    await expect(page.getByTestId('contact-support-form')).toBeVisible();
  });

  test('anonymous general contact submits and shows a reference', async ({ page }) => {
    await page.goto('/en/contact');
    await page.getByTestId('contact-support-name').fill('Guest Tester');
    await page.getByTestId('contact-support-email').fill(`pw-guest-${Date.now()}@example.com`);
    await page.getByTestId('contact-support-subject').fill('Website contact question');
    await page.getByTestId('contact-support-message').fill('Please tell me how booking support works.');
    await page.getByTestId('contact-support-submit').click();
    await expect(page.getByTestId('contact-support-success')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('contact-support-ref')).toContainText('SP-');
    await expect(page.getByTestId('contact-support-submit')).toHaveCount(0);
  });

  test('customer can open booking help, admin can reply, Arabic labels render', async ({ page }) => {
    test.setTimeout(150_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const slot = await findAvailableSlot({ minDaysAhead: 8, maxDaysAhead: 30 });
    const created = await createBookingViaApi(cookie, slot, 2);
    expect(created.bookingId).toBeTruthy();

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId('my-bookings')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole('heading', { name: 'حجوزاتي' })).toBeVisible();
    const helpButton = page.getByTestId(`booking-support-open-${created.bookingId}`);
    await helpButton.scrollIntoViewIfNeeded();
    await expect(helpButton).toBeVisible();
    await expect(helpButton).toContainText('مشكلة في الحجز');
    await helpButton.click();
    await page.getByTestId(`booking-support-subject-${created.bookingId}`).fill('استفسار عن الحجز');
    await page.getByTestId(`booking-support-message-${created.bookingId}`).fill('أحتاج مساعدة بخصوص حالة هذا الحجز.');
    await page.getByTestId(`booking-support-submit-${created.bookingId}`).click();
    await expect(page.getByTestId(`booking-support-success-${created.bookingId}`)).toBeVisible({
      timeout: 20_000,
    });
    const ref = (await page.getByTestId(`booking-support-ref-${created.bookingId}`).innerText()).trim();
    expect(ref.startsWith('SP-')).toBeTruthy();

    await page.goto('/en/account/bookings');
    await expect(page.getByTestId(`booking-support-status-${created.bookingId}`)).toBeVisible();
    await expect(page.getByTestId(`booking-support-open-${created.bookingId}`)).toHaveCount(0);

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/en/admin/support');
    await expect(page.getByTestId('admin-support')).toBeVisible({ timeout: 20_000 });
    const row = page.getByTestId(`admin-support-row-${ref}`);
    await expect(row).toBeVisible();
    await row.getByRole('button').first().click();
    await row.locator('textarea').fill('We will review this booking.');
    await row.getByRole('button', { name: 'In progress' }).click();
    await expect(row).toContainText('In progress');

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/en/account/support');
    await expect(page.getByTestId('my-support')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(ref)).toBeVisible();
    await expect(page.getByText('We will review this booking.')).toBeVisible();
  });

  test('mobile contact and booking help remain usable; booking page still works', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/contact');
    const box = await page.getByTestId('contact-support-form').boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId('my-bookings')).toBeVisible({ timeout: 40_000 });
    await expect(page.getByTestId('booking-card').first()).toBeVisible();
    await expect(page.getByTestId('account-nav-support')).toBeVisible();

    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.getByTestId('booking-panel')).toBeVisible({
      timeout: 30_000,
    });
  });
});
