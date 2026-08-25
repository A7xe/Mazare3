import { getApiBase, PROPERTY_SLUG } from '../constants.js';

export type AvailableSlot = {
  date: string;
  period: string;
  price: number;
  status: string;
};

export type FindSlotOptions = {
  /** First day offset from today (UTC). Default 1. */
  minDaysAhead?: number;
  /** Last day offset from today (UTC). Default minDaysAhead + 44. */
  maxDaysAhead?: number;
  slug?: string;
};

function addDaysUtc(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function waitForApiHealth(maxAttempts = 30): Promise<void> {
  const healthUrl = `${getApiBase()}/health`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    'API health check failed — ensure Playwright webServer started API on port 4010',
  );
}

/** Fetch availability and return the first available slot in the window. */
export async function findAvailableSlot(
  options: FindSlotOptions | string = {},
): Promise<AvailableSlot> {
  const opts = typeof options === 'string' ? { slug: options } : options;
  const slug = opts.slug ?? PROPERTY_SLUG;
  const min = opts.minDaysAhead ?? 1;
  const max = opts.maxDaysAhead ?? min + 44;
  const from = addDaysUtc(min);
  const to = addDaysUtc(max);
  const url = `${getApiBase()}/properties/${slug}/availability?from=${from}&to=${to}`;
  let res = await fetch(url);
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(url);
  }
  if (!res.ok) {
    throw new Error(`Availability API failed (${res.status}). Run pnpm db:seed`);
  }
  const body = (await res.json()) as { data: AvailableSlot[] };
  const available = body.data.filter((s) => s.status === 'available');
  const periodPreference = ['evening', 'morning', 'full_day', 'overnight'];
  const slot =
    periodPreference
      .map((period) => available.find((s) => s.period === period))
      .find((s): s is AvailableSlot => s != null) ?? available[0];
  if (slot) return slot;

  const ensure = await fetch(`${getApiBase()}/internal/properties/${slug}/ensure-available-slot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (ensure.ok) {
    const created = (await ensure.json()) as {
      data?: { date: string; period: string; price: number };
    };
    if (created.data?.date) {
      return {
        date: created.data.date,
        period: created.data.period,
        price: created.data.price,
        status: 'available',
      };
    }
  }
  throw new Error(
    `No available slot between +${min} and +${max} days for ${slug} — run pnpm db:seed`,
  );
}

/** @deprecated Use findAvailableSlot — kept for imports. */
export async function findFirstAvailableSlot(
  slug = PROPERTY_SLUG,
): Promise<AvailableSlot> {
  return findAvailableSlot({ slug, minDaysAhead: 1, maxDaysAhead: 45 });
}

export async function loginViaApi(
  email = 'customer@mazare3.jo',
  password = 'Mazare3Demo2026!',
): Promise<string> {
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`API login failed (${res.status}). Run pnpm db:seed`);
  }
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

export async function logoutViaApi(cookie: string): Promise<void> {
  await fetch(`${getApiBase()}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
}

export async function createBookingViaApi(
  cookie: string,
  slot: Pick<AvailableSlot, 'date' | 'period'>,
  guestsCount: number,
  slug = PROPERTY_SLUG,
): Promise<{ status: number; bookingId: string | null }> {
  const res = await fetch(`${getApiBase()}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      propertySlug: slug,
      date: slot.date,
      period: slot.period,
      guestsCount,
    }),
  });
  let bookingId: string | null = null;
  if (res.ok) {
    const body = (await res.json()) as { data?: { id?: string } };
    bookingId = body.data?.id ?? null;
  }
  return { status: res.status, bookingId };
}

export async function cancelBookingViaApi(cookie: string, bookingId: string): Promise<number> {
  const res = await fetch(`${getApiBase()}/me/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  return res.status;
}
