import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  PROPERTY_SLUG,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { createBookingViaApi, findAvailableSlot, loginViaApi } from './helpers/api.js';

const PAGES = [
  { path: '/about', testId: 'legal-page-about', ar: 'عن مزارع', en: 'About Mazare3' },
  { path: '/contact', testId: 'legal-page-contact', ar: 'تواصل معنا', en: 'Contact us' },
  { path: '/terms', testId: 'legal-page-terms', ar: 'الشروط والأحكام', en: 'Terms & Conditions' },
  { path: '/privacy', testId: 'legal-page-privacy', ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  {
    path: '/cancellation-refund',
    testId: 'legal-page-cancellation-refund',
    ar: 'سياسة الإلغاء والاسترداد',
    en: 'Cancellation & Refund Policy',
  },
  {
    path: '/booking-payment',
    testId: 'legal-page-booking-payment',
    ar: 'سياسة الحجز والدفع',
    en: 'Booking & Payment Policy',
  },
] as const;

const FAKE_MARKERS = ['Example Company', 'John Doe', '123456'];

test.describe('Public trust and legal pages (10H.3A)', () => {
  test.describe.configure({ retries: 0 });

  test('all six pages work in Arabic and English without authentication', async ({ page }) => {
    test.setTimeout(120_000);
    for (const item of PAGES) {
      await page.goto(`/ar${item.path}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      const arPage = page.getByTestId(item.testId);
      await expect(arPage).toBeVisible({ timeout: 20_000 });
      await expect(arPage.getByRole('heading', { level: 1 })).toHaveText(item.ar);
      const arHtml = await arPage.innerText();
      for (const fake of FAKE_MARKERS) expect(arHtml).not.toContain(fake);

      await page.goto(`/en${item.path}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      const enPage = page.getByTestId(item.testId);
      await expect(enPage).toBeVisible({ timeout: 20_000 });
      await expect(enPage.getByRole('heading', { level: 1 })).toHaveText(item.en);
    }
  });

  test('footer links, privacy claims, refund tiers, and location privacy', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/ar');
    await expect(page.getByTestId('footer-legal-nav')).toBeVisible();
    await page.getByTestId('footer-legal-privacy').click();
    await expect(page.getByTestId('legal-page-privacy')).toBeVisible();
    const privacy = await page.getByTestId('legal-page-privacy').innerText();
    expect(privacy).toMatch(/PAN|رقم البطاقة/);
    expect(privacy).toMatch(/CVV/);
    expect(privacy.toLowerCase()).not.toMatch(/mazare3 stores (your )?card number/);
    expect(privacy).toMatch(/موقع تقريبي|exact location|الموقع الدقيق/);

    await page.goto('/en/cancellation-refund');
    const cancel = await page.getByTestId('legal-page-cancellation-refund').innerText();
    expect(cancel).toContain('72');
    expect(cancel).toContain('24');
    expect(cancel).toContain('50%');
    expect(cancel).toMatch(/payment provider/i);
    expect(cancel.toLowerCase()).not.toContain('instant automatic card refund');

    await page.goto('/en/booking-payment');
    const pay = await page.getByTestId('legal-page-booking-payment').innerText();
    expect(pay).toMatch(/checkout/i);
    expect(pay.toLowerCase()).not.toContain('paytabs profile');
    expect(pay).toMatch(/reconcil|provider/i);

    await page.goto('/en/contact');
    await expect(page.getByTestId('contact-identity-unpublished')).toBeVisible();
    await expect(page.getByTestId('legal-related-nav').getByRole('link').first()).toBeVisible();
  });

  test('mobile readability and booking flow still shows policy links', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/terms');
    const box = await page.getByTestId('legal-page-terms').boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
    await expect(page.getByTestId('legal-toc')).toBeVisible();

    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.getByTestId('booking-legal-notice')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('booking-legal-notice').getByRole('link', { name: /الشروط/ })).toBeVisible();

    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const slot = await findAvailableSlot();
    const created = await createBookingViaApi(cookie, slot, 2);
    expect(created.bookingId).toBeTruthy();
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto(`/ar/checkout/${created.bookingId}`);
    await expect(page.getByTestId('checkout-legal-notice')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('checkout-simulate-success')).toBeVisible({ timeout: 20_000 });
  });
});
