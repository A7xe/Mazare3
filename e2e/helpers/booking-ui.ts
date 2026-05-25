import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { AvailableSlot } from './api.js';
export async function gotoProperty(page: Page, locale: 'ar' | 'en', slug: string) {
  await page.goto(`/${locale}/properties/${slug}`);
  await expect(page.getByTestId('booking-panel')).toBeVisible();
}

/** Set date, load availability, and pick period + guests. */
export async function selectBookingSlot(page: Page, slot: AvailableSlot, guests = 6) {
  const dateInput = page.getByTestId('booking-date');
  await dateInput.click();
  await dateInput.fill(slot.date);
  await dateInput.blur();
  await expect(page.getByText(/اختر الفترة|Select period/i)).toBeVisible({ timeout: 10_000 });
  const periodBtn = page.getByTestId(`booking-period-${slot.period}`);
  await expect(periodBtn).toBeVisible({ timeout: 25_000 });
  await periodBtn.click();
  await expect(periodBtn).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('booking-guests').fill(String(guests));
  await expect(page.getByTestId('booking-submit')).toBeEnabled({ timeout: 10_000 });
}

export async function expectDraftRestored(page: Page, slot: AvailableSlot, guests: number) {
  await expect(page.getByTestId('booking-date')).toHaveValue(slot.date, { timeout: 15_000 });
  const periodBtn = page.getByTestId(`booking-period-${slot.period}`);
  await expect(periodBtn).toBeVisible({ timeout: 25_000 });
  await expect(periodBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  await expect(page.getByTestId('booking-guests')).toHaveValue(String(guests));
}

export async function clickBookNow(page: Page) {
  await page.getByTestId('booking-submit').click();
}
