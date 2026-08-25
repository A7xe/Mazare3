/**
 * Real PayTabs TEST 20 JOD partial refund via Mazare3 refund state machine.
 * Does not complete a new payment, refund the deposit, or cancel the booking.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(root, '.env'), override: true });

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const BOOKING_ID = 'cmswzvm1w0005uvuc42bcu3g2';
const DEPOSIT_ID = 'cmswzvq0v0001uvdkuqyrqlib';
const DEPOSIT_REF = 'TST2622902775094';
const BALANCE_ID = 'cmsx31gzg000juv5o3s2cuz58';
const BALANCE_REF = 'TST2622902775222';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

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
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

function n(v: unknown) {
  return typeof v === 'number' ? v : Number(v);
}

function redact(msg: unknown) {
  return String(msg)
    .replace(/SWJ[A-Z0-9-]+/gi, '[redacted]')
    .replace(/Authorization["']?\s*[:=]\s*["']?[^"'\s]+/gi, 'Authorization:[redacted]')
    .slice(0, 400);
}

async function main() {
  const { prisma } = await import('@mazare3/db');
  const { PayTabsPaymentGateway } = await import('../src/services/payment/paytabs-payment-gateway.ts');

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: BOOKING_ID },
      include: {
        payments: {
          select: {
            id: true,
            purpose: true,
            status: true,
            amount: true,
            providerRef: true,
            payoutStatus: true,
            refundStatus: true,
          },
        },
        refundRequests: {
          select: { id: true, status: true, requestedAmount: true, approvedAmount: true },
        },
      },
    });
    if (!booking || booking.publicCode !== 'MZ-02618EAB') {
      console.log(JSON.stringify({ ok: false, error: 'booking not found' }));
      process.exit(1);
    }
    const deposit = booking.payments.find((p) => p.id === DEPOSIT_ID);
    const balance = booking.payments.find((p) => p.id === BALANCE_ID);
    const paidPayout = await prisma.ownerPayout.findFirst({
      where: {
        bookingId: BOOKING_ID,
        status: 'paid',
      },
      select: { id: true, status: true },
    });
    const blockingRefund = booking.refundRequests.filter((r) =>
      ['pending', 'approved'].includes(r.status),
    );
    const alreadyRefunded = booking.refundRequests
      .filter((r) => r.status === 'approved' || r.status === 'processed')
      .reduce((sum, r) => sum + n(r.approvedAmount ?? r.requestedAmount), 0);

    const preflightOk =
      booking.status === 'confirmed' &&
      booking.paymentState === 'fully_paid' &&
      deposit?.status === 'succeeded' &&
      n(deposit.amount) === 84 &&
      deposit.providerRef === DEPOSIT_REF &&
      balance?.status === 'succeeded' &&
      n(balance.amount) === 196 &&
      balance.providerRef === BALANCE_REF &&
      alreadyRefunded + 20 <= 280.001 &&
      blockingRefund.length === 0 &&
      !paidPayout &&
      balance.payoutStatus !== 'paid';

    if (!preflightOk) {
      console.log(
        JSON.stringify({
          ok: false,
          error: 'preflight failed',
          booking: {
            status: booking.status,
            paymentState: booking.paymentState,
          },
          alreadyRefunded,
          blockingRefund: blockingRefund.length,
          paidPayout: paidPayout?.status ?? null,
        }),
      );
      process.exit(1);
    }

    cookieJar = '';
    const loginC = await api('POST', '/auth/login', CUSTOMER, false);
    if (loginC.status !== 200) {
      console.log(JSON.stringify({ ok: false, error: `customer login ${loginC.status}` }));
      process.exit(1);
    }

    const created = await api('POST', `/me/bookings/${BOOKING_ID}/refund-request`, {
      reason: 'PayTabs TEST partial refund of 20 JOD on the balance installment.',
      requestedAmount: 20,
    });
    if (created.status !== 201) {
      console.log(
        JSON.stringify({
          ok: false,
          stage: 'create_refund_request',
          error: created.json.error ?? created.status,
          code: created.json.code ?? null,
        }),
      );
      process.exit(1);
    }
    const refundReq = created.json.data as { id?: string; status?: string; requestedAmount?: number };
    if (!refundReq.id) {
      console.log(JSON.stringify({ ok: false, error: 'missing refund request id' }));
      process.exit(1);
    }

    cookieJar = '';
    const loginA = await api('POST', '/auth/login', ADMIN, false);
    if (loginA.status !== 200) {
      console.log(JSON.stringify({ ok: false, error: `admin login ${loginA.status}` }));
      process.exit(1);
    }

    const approved = await api('PATCH', `/admin/refund-requests/${refundReq.id}/status`, {
      status: 'approved',
      approvedAmount: 20,
      adminNote: 'TEST partial refund 20 JOD against balance TST2622902775222',
    });
    if (approved.status !== 200) {
      console.log(
        JSON.stringify({
          ok: false,
          stage: 'approve',
          error: approved.json.error ?? approved.status,
          code: approved.json.code ?? null,
        }),
      );
      process.exit(1);
    }

    const processed = await api('PATCH', `/admin/refund-requests/${refundReq.id}/status`, {
      status: 'processed',
      approvedAmount: 20,
    });
    if (processed.status !== 200) {
      console.log(
        JSON.stringify({
          ok: false,
          stage: 'process_paytabs_refund',
          error: processed.json.error ?? processed.status,
          code: processed.json.code ?? null,
        }),
      );
      process.exit(1);
    }

    let queryResult: { status?: string; providerRef?: string; providerStatus?: string | null } | null =
      null;
    let queryError: string | null = null;
    try {
      const gw = new PayTabsPaymentGateway();
      queryResult = await gw.retrievePayment({
        paymentId: BALANCE_ID,
        providerRef: BALANCE_REF,
      });
    } catch (err) {
      queryError = redact(err instanceof Error ? err.message : err);
    }

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'refund_request', entityId: refundReq.id, action: 'refund.processed_manual' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, createdAt: true },
    });
    const meta = (audit?.metadata ?? {}) as Record<string, unknown>;

    const afterBooking = await prisma.booking.findUnique({
      where: { id: BOOKING_ID },
      select: {
        status: true,
        paymentState: true,
        cancelledAt: true,
        fullyPaidAt: true,
      },
    });
    const afterPayments = await prisma.payment.findMany({
      where: { bookingId: BOOKING_ID },
      select: {
        id: true,
        purpose: true,
        status: true,
        amount: true,
        providerRef: true,
        refundStatus: true,
        payoutStatus: true,
        payoutAvailableAt: true,
      },
    });
    const afterRefund = await prisma.refundRequest.findUnique({
      where: { id: refundReq.id },
      select: {
        id: true,
        paymentId: true,
        status: true,
        requestedAmount: true,
        approvedAmount: true,
      },
    });
    const refundCount = await prisma.refundRequest.count({
      where: { bookingId: BOOKING_ID, status: { in: ['approved', 'processed'] } },
    });

    const depositAfter = afterPayments.find((p) => p.id === DEPOSIT_ID);
    const balanceAfter = afterPayments.find((p) => p.id === BALANCE_ID);
    const captured = afterPayments
      .filter((p) => p.status === 'succeeded')
      .reduce((s, p) => s + n(p.amount), 0);
    const refunded = n(afterRefund?.approvedAmount ?? afterRefund?.requestedAmount);
    const net = captured - refunded;

    const ok =
      processed.status === 200 &&
      afterRefund?.status === 'processed' &&
      n(afterRefund.approvedAmount) === 20 &&
      afterRefund.paymentId === BALANCE_ID &&
      depositAfter?.status === 'succeeded' &&
      n(depositAfter.amount) === 84 &&
      depositAfter.providerRef === DEPOSIT_REF &&
      balanceAfter?.status === 'succeeded' &&
      n(balanceAfter.amount) === 196 &&
      balanceAfter.providerRef === BALANCE_REF &&
      afterBooking?.status === 'confirmed' &&
      afterBooking.paymentState === 'partially_refunded' &&
      afterBooking.cancelledAt == null &&
      refundCount === 1 &&
      captured === 280 &&
      refunded === 20 &&
      net === 260;

    console.log(
      JSON.stringify(
        {
          ok,
          refundRequestId: afterRefund?.id ?? refundReq.id,
          refundedPaymentId: afterRefund?.paymentId ?? null,
          refundAmount: refunded,
          paytabsRefundRef: meta.providerRefundRef ?? null,
          paytabsRefundStatus: meta.providerRefundStatus ?? null,
          paytabsProviderStatus: meta.providerStatus ?? null,
          paytabsQuery: queryResult,
          paytabsQueryError: queryError,
          internalRefundState: afterRefund?.status ?? null,
          booking: afterBooking,
          captured,
          refunded,
          net,
          deposit: depositAfter,
          balance: {
            id: balanceAfter?.id,
            status: balanceAfter?.status,
            amount: balanceAfter ? n(balanceAfter.amount) : null,
            providerRef: balanceAfter?.providerRef,
            refundStatus: balanceAfter?.refundStatus,
            payoutStatus: balanceAfter?.payoutStatus,
            payoutAvailableAt: balanceAfter?.payoutAvailableAt?.toISOString() ?? null,
          },
          refundCount,
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
  console.log(JSON.stringify({ ok: false, error: redact(err instanceof Error ? err.message : err) }));
  process.exit(1);
});
