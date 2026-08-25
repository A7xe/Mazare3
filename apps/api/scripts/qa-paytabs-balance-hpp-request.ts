/**
 * Create remaining-balance PayTabs TEST intent for MZ-02618EAB.
 * Stops after hosted URL. Does not complete HPP, simulate, query, or refund.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(root, '.env'), override: true });

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const BOOKING_ID = 'cmswzvm1w0005uvuc42bcu3g2';
const DEPOSIT_PAYMENT_ID = 'cmswzvq0v0001uvdkuqyrqlib';
const DEPOSIT_TRAN_REF = 'TST2622902775094';
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
  if (setCookie.length) cookieJar = setCookie.map((c) => c.split(';')[0]!).join('; ');
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function n(v: unknown) {
  return typeof v === 'number' ? v : Number(v);
}

async function main() {
  const { prisma } = await import('@mazare3/db');
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: BOOKING_ID },
      select: {
        id: true,
        publicCode: true,
        status: true,
        paymentState: true,
        remainingAmount: true,
        depositAmount: true,
        depositPaidAt: true,
        payments: {
          select: { id: true, purpose: true, status: true, amount: true, providerRef: true },
        },
      },
    });
    if (!booking || booking.publicCode !== 'MZ-02618EAB') {
      console.log(JSON.stringify({ ok: false, error: 'booking not found' }));
      process.exit(1);
    }

    const succeededDeposit = booking.payments.filter(
      (p) => p.status === 'succeeded' && p.purpose === 'deposit',
    );
    const succeededBalance = booking.payments.filter(
      (p) => p.status === 'succeeded' && p.purpose === 'balance',
    );
    const depositRow = succeededDeposit.find((p) => p.id === DEPOSIT_PAYMENT_ID);
    const eligible =
      booking.status === 'confirmed' &&
      booking.paymentState === 'deposit_paid' &&
      succeededDeposit.length === 1 &&
      n(booking.remainingAmount) === 196 &&
      succeededBalance.length === 0 &&
      depositRow?.providerRef === DEPOSIT_TRAN_REF &&
      n(depositRow.amount) === 84;

    const bookingState = {
      publicCode: booking.publicCode,
      status: booking.status,
      paymentState: booking.paymentState,
      remainingAmount: n(booking.remainingAmount),
      depositAmount: n(booking.depositAmount),
      succeededDepositCount: succeededDeposit.length,
      succeededBalanceCount: succeededBalance.length,
    };

    if (!eligible) {
      console.log(JSON.stringify({ ok: false, error: 'not eligible for balance payment', bookingState }));
      process.exit(1);
    }

    const login = await api('POST', '/auth/login', CUSTOMER, false);
    if (login.status !== 200) {
      console.log(JSON.stringify({ ok: false, error: `login ${login.status}`, bookingState }));
      process.exit(1);
    }

    const created = await api('POST', '/payments/create-intent', {
      bookingId: BOOKING_ID,
      method: 'card',
      purpose: 'balance',
    });
    if (created.status !== 201) {
      console.log(
        JSON.stringify({
          ok: false,
          error: created.json.error ?? `create-intent ${created.status}`,
          code: created.json.code ?? null,
          bookingState,
        }),
      );
      process.exit(1);
    }

    const summary = created.json.data as {
      id?: string;
      amount?: number;
      currency?: string;
      purpose?: string;
      provider?: string;
      providerRef?: string | null;
      status?: string;
      redirectUrl?: string | null;
    };

    const row = await prisma.payment.findUnique({
      where: { id: summary.id },
      select: {
        id: true,
        amount: true,
        currency: true,
        purpose: true,
        provider: true,
        providerRef: true,
        status: true,
        bookingId: true,
      },
    });
    const depositAfter = await prisma.payment.findUnique({
      where: { id: DEPOSIT_PAYMENT_ID },
      select: { status: true, providerRef: true, amount: true, purpose: true },
    });

    const redirectUrl = summary.redirectUrl ?? null;
    const looksHosted =
      typeof redirectUrl === 'string' &&
      redirectUrl.startsWith('https://') &&
      redirectUrl.includes('paytabs.com');
    const newRef = row?.providerRef ?? null;
    const ok =
      Boolean(looksHosted) &&
      row?.provider === 'paytabs' &&
      row.purpose === 'balance' &&
      n(row.amount) === 196 &&
      row.currency === 'JOD' &&
      Boolean(newRef) &&
      newRef !== DEPOSIT_TRAN_REF &&
      depositAfter?.status === 'succeeded' &&
      depositAfter.providerRef === DEPOSIT_TRAN_REF;

    console.log(
      JSON.stringify(
        {
          ok,
          bookingState,
          paymentId: row?.id ?? null,
          amount: row ? n(row.amount) : null,
          currency: row?.currency ?? null,
          purpose: row?.purpose ?? null,
          provider: row?.provider ?? null,
          providerRef: newRef,
          redirectUrl,
          status: row?.status ?? null,
          depositUnchanged:
            depositAfter?.status === 'succeeded' && depositAfter.providerRef === DEPOSIT_TRAN_REF,
          providerError: ok ? null : (created.json.error ?? 'PayTabs TEST request was not accepted as 196 JOD hosted page'),
        },
        null,
        2,
      ),
    );
    process.exit(ok ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
