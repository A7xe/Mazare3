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

test.describe('Property promotions (10F.1)', () => {
  test('owner offer appears on Arabic search, detail, and booking snapshot', async ({ page }) => {
    test.setTimeout(120_000);
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const listRes = await fetch(`${getApiBase()}/owner/properties`, {
      headers: { Cookie: ownerCookie },
    });
    const listBody = (await listRes.json()) as { data?: Array<{ id: string; slug: string }> };
    const property = listBody.data?.find((p) => p.slug === PROPERTY_SLUG);
    expect(property?.id).toBeTruthy();

    const existingPromos = await fetch(`${getApiBase()}/owner/properties/${property!.id}/promotions`, {
      headers: { Cookie: ownerCookie },
    });
    const existingList = (await existingPromos.json()) as { data?: Array<{ id: string; status: string }> };
    for (const p of existingList.data ?? []) {
      if (p.status === 'active') {
        await fetch(`${getApiBase()}/owner/properties/${property!.id}/promotions/${p.id}/pause`, {
          method: 'POST',
          headers: { Cookie: ownerCookie },
        });
      }
    }

    const slotRes = await fetch(`${getApiBase()}/internal/properties/${PROPERTY_SLUG}/ensure-available-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const slotBody = (await slotRes.json()) as { data?: { date: string; period: string; price: number } };
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
    await expect(page.getByTestId('owner-promotions')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('promo-title-ar').fill('عرض خاص');
    await page.getByTestId('promo-title-en').fill('E2E offer');
    await page.getByTestId('promo-type').selectOption('percentage');
    await page.getByTestId('promo-value').fill('10');
    await page.getByTestId('promo-create').click();
    await expect(page.getByTestId('promo-row-active').first()).toBeVisible({ timeout: 15_000 });

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto(`/ar/search?date=${slot.date}&period=${slot.period}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const card = page.getByTestId(`property-card-${PROPERTY_SLUG}`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId('offer-badge')).toBeVisible();
    await expect(card.getByTestId('price-original')).toBeVisible();
    await expect(card.getByTestId('price-final')).toBeVisible();

    await page.goto(`/ar/properties/${PROPERTY_SLUG}?date=${slot.date}&period=${slot.period}`);
    await expect(page.getByTestId('booking-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('property-offers')).toBeVisible({ timeout: 20_000 });
    await selectBookingSlot(page, slot, 4);
    await expect(page.getByTestId('booking-summary-discount')).toBeVisible();
    await expect(page.getByTestId('booking-summary-deposit')).toBeVisible();
    await expect(page.getByTestId('booking-summary-remaining')).toBeVisible();

    const [bookRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
      ),
      clickBookNow(page),
    ]);
    expect(bookRes.ok()).toBeTruthy();
    const created = (await bookRes.json()) as {
      data?: { id?: string; totalAmount?: number; originalSlotPrice?: number; promotionId?: string };
    };
    expect(created.data?.promotionId).toBeTruthy();
    expect(created.data?.originalSlotPrice).toBeGreaterThan(created.data?.totalAmount ?? 0);

    const customerCookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const snap = await fetch(`${getApiBase()}/me/bookings/${created.data!.id}`, {
      headers: { Cookie: customerCookie },
    });
    const snapBody = (await snap.json()) as {
      data?: { totalAmount: number; originalSlotPrice: number; promotionDiscountAmount: number };
    };
    expect(snapBody.data?.promotionDiscountAmount).toBeGreaterThan(0);
    expect(snapBody.data!.originalSlotPrice).toBeGreaterThan(snapBody.data!.totalAmount);

    await fetch(`${getApiBase()}/me/bookings/${created.data!.id}/cancel`, {
      method: 'POST',
      headers: { Cookie: customerCookie },
    });
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
  });
});
