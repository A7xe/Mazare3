import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { clickBookNow, selectBookingSlot } from './helpers/booking-ui.js';

test.describe('Owner-funded coupons (10F.2A)', () => {
  test('Arabic coupon apply, booking, redeem, and per-customer limit', async ({ page }) => {
    test.setTimeout(150_000);
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const listRes = await fetch(`${getApiBase()}/owner/properties`, {
      headers: { Cookie: ownerCookie },
    });
    const listBody = (await listRes.json()) as { data?: Array<{ id: string; slug: string }> };
    const property = listBody.data?.find((p) => p.slug === PROPERTY_SLUG);
    expect(property?.id).toBeTruthy();

    const promos = await fetch(`${getApiBase()}/owner/properties/${property!.id}/promotions`, {
      headers: { Cookie: ownerCookie },
    });
    const promoList = (await promos.json()) as { data?: Array<{ id: string; status: string }> };
    for (const p of promoList.data ?? []) {
      if (p.status === 'active') {
        await fetch(`${getApiBase()}/owner/properties/${property!.id}/promotions/${p.id}/pause`, {
          method: 'POST',
          headers: { Cookie: ownerCookie },
        });
      }
    }
    const coupons = await fetch(`${getApiBase()}/owner/properties/${property!.id}/coupons`, {
      headers: { Cookie: ownerCookie },
    });
    const couponList = (await coupons.json()) as { data?: Array<{ id: string; status: string }> };
    for (const c of couponList.data ?? []) {
      if (c.status === 'active') {
        await fetch(`${getApiBase()}/owner/properties/${property!.id}/coupons/${c.id}/pause`, {
          method: 'POST',
          headers: { Cookie: ownerCookie },
        });
      }
    }

    const code = `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const slotRes = await fetch(`${getApiBase()}/internal/properties/${PROPERTY_SLUG}/ensure-available-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const slotBody = (await slotRes.json()) as {
      data?: { date: string; period: string; price: number };
    };
    expect(slotRes.status).toBe(200);
    const slot = {
      date: slotBody.data!.date,
      period: slotBody.data!.period,
      price: slotBody.data!.price,
      status: 'available',
    };

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/properties/${property!.id}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('owner-coupons')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('coupon-code').fill(code);
    await page.getByTestId('coupon-value').fill('10');
    await page.getByTestId('coupon-create').click();
    await expect(page.getByTestId('coupon-row-active').first()).toBeVisible({ timeout: 15_000 });

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto(
      `/ar/properties/${PROPERTY_SLUG}/book?date=${slot.date}&period=${slot.period}`,
    );
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('booking-panel')).toBeVisible({ timeout: 20_000 });
    await selectBookingSlot(page, slot, 4);
    await expect(page.getByTestId('coupon-box')).toBeVisible();
    await page.getByTestId('coupon-input').fill(code.toLowerCase());
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('booking-summary-discount')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('booking-summary-deposit')).toBeVisible();
    await expect(page.getByTestId('booking-summary-remaining')).toBeVisible();

    const [bookRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST' && !res.url().includes('validate'),
      ),
      clickBookNow(page),
    ]);
    expect(bookRes.ok()).toBeTruthy();
    const created = (await bookRes.json()) as { data?: { id?: string; couponDiscountAmount?: number } };
    expect(created.data?.couponDiscountAmount).toBeGreaterThan(0);

    await page.waitForURL(/\/ar\/checkout\//);
    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/ar\/account\/bookings/);

    const ownerCoupons = await fetch(`${getApiBase()}/owner/properties/${property!.id}/coupons`, {
      headers: { Cookie: ownerCookie },
    });
    const after = (await ownerCoupons.json()) as {
      data?: Array<{ normalizedCode: string; usageCount: number }>;
    };
    const used = after.data?.find((c) => c.normalizedCode === code);
    expect(used?.usageCount).toBeGreaterThanOrEqual(1);

    const nextEnsure = await fetch(`${getApiBase()}/internal/properties/${PROPERTY_SLUG}/ensure-available-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const nextBody = (await nextEnsure.json()) as {
      data?: { date: string; period: string; price: number };
    };
    const nextSlot = {
      date: nextBody.data!.date,
      period: nextBody.data!.period,
      price: nextBody.data!.price,
      status: 'available',
    };
    await page.goto(
      `/ar/properties/${PROPERTY_SLUG}/book?date=${nextSlot.date}&period=${nextSlot.period}`,
    );
    await selectBookingSlot(page, nextSlot, 4);
    await page.getByTestId('coupon-input').fill(code);
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('booking-error')).toBeVisible({ timeout: 15_000 });

    const still = await fetch(`${getApiBase()}/owner/properties/${property!.id}/coupons`, {
      headers: { Cookie: ownerCookie },
    });
    const stillList = (await still.json()) as { data?: Array<{ id: string; status: string }> };
    for (const c of stillList.data ?? []) {
      if (c.status === 'active') {
        await fetch(`${getApiBase()}/owner/properties/${property!.id}/coupons/${c.id}/pause`, {
          method: 'POST',
          headers: { Cookie: ownerCookie },
        });
      }
    }
  });
});
