import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
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

test.describe('Platform-funded coupons (10F.2B)', () => {
  test('Arabic admin coupon, customer apply, owner net unchanged', async ({ page }) => {
    test.setTimeout(150_000);
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
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
    const platformList = await fetch(`${getApiBase()}/admin/platform-coupons`, {
      headers: { Cookie: adminCookie },
    });
    const platformBody = (await platformList.json()) as { data?: Array<{ id: string; status: string }> };
    for (const c of platformBody.data ?? []) {
      if (c.status === 'active') {
        await fetch(`${getApiBase()}/admin/platform-coupons/${c.id}/pause`, {
          method: 'POST',
          headers: { Cookie: adminCookie },
        });
      }
    }

    const code = `P2E${Date.now().toString(36).slice(-5).toUpperCase()}`;
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
    const merchant = slot.price;
    const expectedPayable = Math.round((merchant - 20) * 100) / 100;

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar/admin/coupons');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('admin-platform-coupons')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('platform-coupon-code').fill(code);
    await page.getByTestId('platform-coupon-value').fill('20');
    await page.getByTestId('platform-coupon-create').click();
    await expect(page.getByTestId('platform-coupon-row-active').first()).toBeVisible({ timeout: 15_000 });

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto(`/ar/properties/${PROPERTY_SLUG}?date=${slot.date}&period=${slot.period}`);
    await expect(page.getByTestId('booking-panel')).toBeVisible({ timeout: 20_000 });
    await selectBookingSlot(page, slot, 4);
    const priceBefore = await page.getByTestId('booking-summary-price').innerText();
    const depositBefore = await page.getByTestId('booking-summary-deposit').innerText();
    const remainingBefore = await page.getByTestId('booking-summary-remaining').innerText();
    await page.getByTestId('coupon-input').fill(code.toLowerCase());
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('booking-summary-discount')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('booking-summary-price')).not.toHaveText(priceBefore);
    await expect(page.getByTestId('booking-summary-deposit')).not.toHaveText(depositBefore);
    await expect(page.getByTestId('booking-summary-remaining')).not.toHaveText(remainingBefore);
    await expect(page.getByTestId('booking-summary-price')).toContainText(String(expectedPayable));

    const [bookRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST' && !res.url().includes('validate'),
      ),
      clickBookNow(page),
    ]);
    expect(bookRes.ok()).toBeTruthy();
    const created = (await bookRes.json()) as {
      data?: {
        id?: string;
        publicCode?: string;
        totalAmount?: number;
        platformDiscountAmount?: number;
        depositAmount?: number;
        remainingAmount?: number;
        ownerNetPayoutAmount?: number;
        platformCommissionAmount?: number;
      };
    };
    expect(created.data?.platformDiscountAmount).toBe(20);
    expect(created.data?.totalAmount).toBe(merchant);
    expect((created.data?.depositAmount ?? 0) + (created.data?.remainingAmount ?? 0)).toBeCloseTo(
      expectedPayable,
      2,
    );

    await page.waitForURL(/\/ar\/checkout\//);
    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/ar\/account\/bookings/);

    const afterCoupons = await fetch(`${getApiBase()}/admin/platform-coupons`, {
      headers: { Cookie: adminCookie },
    });
    const afterBody = (await afterCoupons.json()) as {
      data?: Array<{ id: string; status: string; normalizedCode: string; usageCount: number }>;
    };
    const used = afterBody.data?.find((c) => c.normalizedCode === code);
    expect(used?.usageCount).toBeGreaterThanOrEqual(1);

    const adminRows = await fetch(`${getApiBase()}/admin/bookings`, {
      headers: { Cookie: adminCookie },
    });
    const adminBody = (await adminRows.json()) as {
      data?: Array<{
        publicCode: string;
        totalAmount: number;
        ownerNetPayoutAmount: number;
        platformCommissionAmount: number;
      }>;
    };
    const adminRow = adminBody.data?.find((b) => b.publicCode === created.data?.publicCode);
    expect(adminRow).toBeTruthy();
    expect(adminRow!.totalAmount).toBe(merchant);
    expect(adminRow!.ownerNetPayoutAmount).toBeCloseTo(
      merchant - adminRow!.platformCommissionAmount,
      2,
    );
    expect(adminRow!.ownerNetPayoutAmount).not.toBeCloseTo(
      expectedPayable - adminRow!.platformCommissionAmount,
      2,
    );

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar/admin/bookings');
    await expect(page.getByTestId(`admin-booking-row-${created.data!.publicCode}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(`admin-booking-owner-net-${created.data!.publicCode}`)).toBeVisible();

    for (const c of afterBody.data ?? []) {
      if (c.normalizedCode === code && c.status === 'active') {
        await fetch(`${getApiBase()}/admin/platform-coupons/${c.id}/pause`, {
          method: 'POST',
          headers: { Cookie: adminCookie },
        });
      }
    }
  });
});
