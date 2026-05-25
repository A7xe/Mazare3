import { API_BASE, PROPERTY_SLUG } from '../constants.js';

export type AvailableSlot = {
  date: string;
  period: string;
  price: number;
  status: string;
};

function addDaysUtc(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function waitForApiHealth(maxAttempts = 30): Promise<void> {
  const healthUrl = `${API_BASE}/health`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('API health check failed — run pnpm dev and ensure port 4000 is up');
}

export async function findFirstAvailableSlot(
  slug = PROPERTY_SLUG,
): Promise<AvailableSlot> {
  const from = addDaysUtc(1);
  const to = addDaysUtc(45);
  const url = `${API_BASE}/properties/${slug}/availability?from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Availability API failed (${res.status}). Run pnpm db:seed`);
  }
  const body = (await res.json()) as { data: AvailableSlot[] };
  const slot = body.data.find((s) => s.status === 'available');
  if (!slot) {
    throw new Error('No available slot found in next 45 days — run pnpm db:seed');
  }
  return slot;
}

export async function loginViaApi(
  email = 'customer@mazare3.jo',
  password = 'Mazare3Demo2026!',
): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
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
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
}
