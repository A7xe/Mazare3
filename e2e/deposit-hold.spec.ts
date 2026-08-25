import { test, expect } from '@playwright/test';
import { getApiBase, PROPERTY_SLUG } from './constants.js';
import {
  createBookingViaApi,
  findAvailableSlot,
  loginViaApi,
} from './helpers/api.js';

test.describe('Hold expiry after unpaid booking', () => {
  test('expired hold releases slot and rejects stale payment success', async ({ request }) => {
    test.setTimeout(90_000);
    const slot = await findAvailableSlot({ minDaysAhead: 40, maxDaysAhead: 55 });
    const cookie = await loginViaApi();
    const created = await createBookingViaApi(cookie, slot, 3);
    expect(created.status).toBe(201);
    expect(created.bookingId).toBeTruthy();
    const bookingId = created.bookingId!;

    const intent = await request.post(`${getApiBase()}/payments/create-intent`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { bookingId, method: 'card', purpose: 'deposit' },
    });
    expect(intent.status()).toBe(201);
    const paymentId = ((await intent.json()) as { data?: { id?: string } }).data?.id;
    expect(paymentId).toBeTruthy();

    const backdate = await request.post(`${getApiBase()}/internal/bookings/${bookingId}/backdate-hold`, {
      data: {},
    });
    expect(backdate.status()).toBe(200);

    const expire = await request.post(`${getApiBase()}/internal/payments/expire-stale`, {
      data: {},
    });
    expect(expire.status()).toBe(200);

    const booking = await request.get(`${getApiBase()}/me/bookings/${bookingId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await booking.json()) as { data?: { status?: string } };
    expect(body.data?.status).toBe('expired');

    const stale = await request.post(`${getApiBase()}/payments/${paymentId}/simulate-success`, {
      headers: { Cookie: cookie },
    });
    expect(stale.status()).toBeGreaterThanOrEqual(400);

    const bookingRow = await request.get(`${getApiBase()}/me/bookings/${bookingId}`, {
      headers: { Cookie: cookie },
    });
    const bookingDate = ((await bookingRow.json()) as { data?: { date?: string; period?: string } })
      .data;
    const from = bookingDate?.date ?? slot.date;
    const period = bookingDate?.period ?? slot.period;
    let avail = await request.get(
      `${getApiBase()}/properties/${PROPERTY_SLUG}/availability?from=${from}&to=${from}`,
    );
    if (avail.status() >= 500) {
      await new Promise((r) => setTimeout(r, 1500));
      avail = await request.get(
        `${getApiBase()}/properties/${PROPERTY_SLUG}/availability?from=${from}&to=${from}`,
      );
    }
    expect(avail.status()).toBe(200);
    const slots = ((await avail.json()) as { data?: Array<{ date: string; period: string; status: string }> })
      .data ?? [];
    const row = slots.find((s) => s.date === from && s.period === period);
    expect(row?.status).toBe('available');
  });
});
