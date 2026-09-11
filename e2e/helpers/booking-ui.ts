import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { AvailableSlot } from './api.js';

/** Property detail — informational booking entry only (CB-UX-1). */
export async function gotoPropertyDetail(page: Page, locale: 'ar' | 'en', slug: string) {
  await page.goto(`/${locale}/properties/${slug}`);
  await expect(page.getByTestId('booking-entry-card')).toBeVisible({ timeout: 30_000 });
}

/**
 * Booking configuration page.
 * Most CB flows land here (date/period/guests live off Property Detail).
 */
export async function gotoProperty(page: Page, locale: 'ar' | 'en', slug: string) {
  await page.goto(`/${locale}/properties/${slug}/book`);
  await expect(page.getByTestId('booking-panel')).toBeVisible({ timeout: 30_000 });
}

export async function openBookingFromProperty(page: Page) {
  await page.getByTestId('booking-entry-cta').click();
  await expect(page.getByTestId('booking-panel')).toBeVisible({ timeout: 20_000 });
}

async function waitForCalendarMonthReady(page: Page) {
  await expect(page.getByTestId('booking-calendar-dialog')).toBeVisible({ timeout: 15_000 });
  // Prefer grid; allow error+retry path without spinning forever on skeleton.
  await expect
    .poll(
      async () => {
        if (await page.getByTestId('booking-calendar-grid').isVisible().catch(() => false)) {
          return 'grid';
        }
        if (await page.getByTestId('booking-calendar-error').isVisible().catch(() => false)) {
          return 'error';
        }
        return 'loading';
      },
      { timeout: 25_000 },
    )
    .not.toBe('loading');

  if (await page.getByTestId('booking-calendar-error').isVisible().catch(() => false)) {
    await page.getByTestId('booking-calendar-retry').click();
    await expect(page.getByTestId('booking-calendar-grid')).toBeVisible({ timeout: 25_000 });
  } else {
    await expect(page.getByTestId('booking-calendar-grid')).toBeVisible({ timeout: 5_000 });
  }
  // Month nav is disabled while a fetch is in flight — wait until prev/next stabilize.
  await expect
    .poll(
      async () =>
        !(await page.getByTestId('booking-calendar-skeleton').isVisible().catch(() => false)),
      { timeout: 15_000 },
    )
    .toBeTruthy();
}

/** Open calendar and pick a YYYY-MM-DD cell (platform civil date). */
export async function selectCalendarDate(page: Page, isoDate: string) {
  await page.getByTestId('booking-date-trigger').click();
  await waitForCalendarMonthReady(page);

  const targetMonth = isoDate.slice(0, 7);
  for (let i = 0; i < 10; i++) {
    const day = page.getByTestId(`booking-calendar-day-${isoDate}`);
    if ((await day.count()) > 0) {
      await expect(day).toBeVisible({ timeout: 5_000 });
      if (await day.isEnabled()) {
        await day.click();
        await expect(page.getByTestId('booking-calendar-dialog')).toHaveCount(0);
        await expect(page.getByTestId('booking-date')).toHaveValue(isoDate, { timeout: 10_000 });
        return;
      }
      throw new Error(`Calendar day ${isoDate} is not selectable`);
    }

    const next = page.getByTestId('booking-calendar-next');
    if (await next.isDisabled()) break;
    await next.click();
    await waitForCalendarMonthReady(page);

    // Safety: if we overshot past the target month key in the ISO sense, stop.
    const label = (await page.getByTestId('booking-calendar-month-label').textContent()) ?? '';
    const year = targetMonth.slice(0, 4);
    if (!label.includes(year) && i > 2) {
      /* keep scanning within horizon */
    }
  }
  throw new Error(`Could not find calendar day ${isoDate}`);
}

/** Set date via calendar, pick period + guests. */
export async function selectBookingSlot(page: Page, slot: AvailableSlot, guests = 6) {
  await selectCalendarDate(page, slot.date);

  await expect
    .poll(
      async () => {
        if (await page.getByTestId('booking-period-loading').isVisible().catch(() => false)) {
          return 'loading';
        }
        if (
          await page
            .getByTestId(`booking-period-${slot.period}`)
            .isVisible()
            .catch(() => false)
        ) {
          return 'ready';
        }
        if (await page.getByTestId('booking-period-none').isVisible().catch(() => false)) {
          return 'none';
        }
        if (await page.getByTestId('booking-period-list').isVisible().catch(() => false)) {
          return 'list';
        }
        return 'wait';
      },
      { timeout: 30_000 },
    )
    .toMatch(/ready|list|none/);

  const periodBtn = page.getByTestId(`booking-period-${slot.period}`);
  await expect(periodBtn).toBeVisible({ timeout: 15_000 });
  await periodBtn.click();
  await expect(periodBtn).toHaveAttribute('aria-pressed', 'true');

  const value = page.getByTestId('booking-guests-value');
  await expect(value).toBeVisible();
  for (let i = 0; i < 40; i++) {
    const current = Number((await value.textContent())?.trim() ?? '0');
    if (current === guests) break;
    if (current < guests) {
      const inc = page.getByTestId('booking-guests-increase');
      if (await inc.isDisabled()) break;
      await inc.click();
    } else {
      const dec = page.getByTestId('booking-guests-decrease');
      if (await dec.isDisabled()) break;
      await dec.click();
    }
  }
  await expect(page.getByTestId('booking-guests')).toHaveValue(String(guests), {
    timeout: 10_000,
  });
  await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('booking-submit')).toBeEnabled({ timeout: 15_000 });
}

export async function expectDraftRestored(page: Page, slot: AvailableSlot, guests: number) {
  await expect(page.getByTestId('booking-date')).toHaveValue(slot.date, { timeout: 15_000 });
  const periodBtn = page.getByTestId(`booking-period-${slot.period}`);
  await expect(periodBtn).toBeVisible({ timeout: 25_000 });
  await expect(periodBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  await expect(page.getByTestId('booking-guests')).toHaveValue(String(guests));
}

export async function clickBookNow(page: Page) {
  const submit = page.getByTestId('booking-submit');
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.scrollIntoViewIfNeeded();
  await Promise.all([
    page
      .waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          /\/bookings(?:\?|$)/.test(new URL(res.url()).pathname) &&
          !res.url().includes('booking-quote') &&
          !res.url().includes('validate'),
        { timeout: 35_000 },
      )
      .catch(() => null),
    submit.click(),
  ]);
}
