/**
 * One-shot PayTabs TEST /payment/request connectivity.
 * Does not complete HPP, simulate, callback, balance, or refund.
 * Never logs Server Key or Authorization headers.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(root, '.env'), override: true });
process.env.PAYMENT_GATEWAY_PROVIDER = 'paytabs';
process.env.PAYMENT_SIMULATE_ENABLED = 'false';

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };

let cookieJar = '';

async function api(method: string, path: string, body?: unknown, useCookie = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function todayPlus(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function findSlot() {
  const from = todayPlus(3);
  const to = todayPlus(40);
  const { status, json } = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${from}&to=${to}`,
    undefined,
    false,
  );
  if (status === 200) {
    const slots = (json.data as Array<{ status: string; date: string; period: string }>) ?? [];
    const slot =
      [...slots].reverse().find((s) => s.status === 'available') ??
      slots.find((s) => s.status === 'available');
    if (slot) return { date: slot.date, period: slot.period };
  }
  const ensured = await api(
    'POST',
    `/internal/properties/${SLUG}/ensure-available-slot`,
    {},
    false,
  );
  const data = ensured.json.data as { date?: string; period?: string } | undefined;
  if (ensured.status === 200 && data?.date) return { date: data.date, period: data.period };
  return null;
}

function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/SWJ[A-Z0-9-]+/gi, '[redacted]')
    .replace(/Authorization["']?\s*[:=]\s*["']?[^"'\s]+/gi, 'Authorization:[redacted]');
}

async function main() {
  const { createPaymentIntent } = await import('../src/services/payment.service.ts');
  const { prisma } = await import('@mazare3/db');
  const { loadPaymentConfig } = await import('../src/config/payment-config.ts');

  try {
    const cfg = loadPaymentConfig();
    if (cfg.provider !== 'paytabs') {
      console.log(
        JSON.stringify({
          ok: false,
          error: `provider resolved to ${cfg.provider}, expected paytabs`,
        }),
      );
      process.exit(1);
    }

    const login = await api('POST', '/auth/login', CUSTOMER, false);
    if (login.status !== 200) {
      console.log(JSON.stringify({ ok: false, error: `login ${login.status}` }));
      process.exit(1);
    }
    const me = await api('GET', '/auth/me');
    const user = (me.json.data as { user?: { id?: string } } | undefined)?.user;
    if (!user?.id) {
      console.log(JSON.stringify({ ok: false, error: 'missing user id' }));
      process.exit(1);
    }

    const slot = await findSlot();
    const { qaEnsureAvailableSlot } = await import('../src/services/internal-qa.service.ts');
    const ensured = slot ?? (await qaEnsureAvailableSlot(SLUG));
    if (!ensured?.date) {
      console.log(JSON.stringify({ ok: false, error: 'no available slot' }));
      process.exit(1);
    }

    const book = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: ensured.date,
      period: ensured.period,
      guestsCount: 4,
    });
    const booking = book.json.data as
      | {
          id?: string;
          publicCode?: string;
          depositAmount?: number;
          remainingAmount?: number;
          currency?: string;
          paymentCollectionMode?: string;
          paymentState?: string;
        }
      | undefined;
    if (book.status !== 201 || !booking?.id) {
      console.log(
        JSON.stringify({
          ok: false,
          error: `booking ${book.status}`,
          code: (book.json as { code?: string }).code,
        }),
      );
      process.exit(1);
    }

    let summary;
    try {
      summary = await createPaymentIntent(user.id, {
        bookingId: booking.id,
        method: 'card',
        purpose: 'deposit',
      });
    } catch (err) {
      console.log(JSON.stringify({ ok: false, stage: 'paytabs_request', error: safeError(err) }));
      process.exit(1);
    }

    const row = await prisma.payment.findUnique({
      where: { id: summary.id },
      select: {
        id: true,
        provider: true,
        providerRef: true,
        amount: true,
        currency: true,
        purpose: true,
        status: true,
      },
    });

    const redirectUrl = summary.redirectUrl ?? null;
    const looksHosted =
      typeof redirectUrl === 'string' &&
      redirectUrl.startsWith('https://') &&
      redirectUrl.includes('paytabs.com');

    console.log(
      JSON.stringify(
        {
          ok: Boolean(looksHosted && row?.provider === 'paytabs' && row.providerRef),
          bookingId: booking.id,
          publicCode: booking.publicCode,
          paymentCollectionMode: booking.paymentCollectionMode,
          paymentState: booking.paymentState,
          paymentId: row?.id,
          provider: row?.provider,
          providerRef: row?.providerRef,
          purpose: row?.purpose,
          amount: row?.amount != null ? Number(row.amount) : null,
          currency: row?.currency,
          bookingDepositAmount: booking.depositAmount,
          redirectUrl,
          status: row?.status,
        },
        null,
        2,
      ),
    );
    process.exit(looksHosted && row?.provider === 'paytabs' && row.providerRef ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.log(
    JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }),
  );
  process.exit(1);
});
