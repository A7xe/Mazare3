/**
 * Read-only inspect of existing PayTabs TEST payment + query.
 * Does not create, simulate, or finalize.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(root, '.env'), override: true });
process.env.PAYMENT_GATEWAY_PROVIDER = 'paytabs';
process.env.PAYMENT_SIMULATE_ENABLED = 'false';

const PAYMENT_ID = 'cmswzvq0v0001uvdkuqyrqlib';
const BOOKING_ID = 'cmswzvm1w0005uvuc42bcu3g2';
const TRAN_REF = 'TST2622902775094';

function redact(obj: unknown): unknown {
  const s = JSON.stringify(obj);
  const cleaned = s
    .replace(/SWJ[A-Z0-9-]+/gi, '[redacted]')
    .replace(/"serverKey"\s*:\s*"[^"]+"/gi, '"serverKey":"[redacted]"')
    .replace(/Authorization["']?\s*[:=]\s*["']?[^"'\s]+/gi, 'Authorization:[redacted]');
  return JSON.parse(cleaned);
}

async function main() {
  const { prisma } = await import('@mazare3/db');
  const { PayTabsPaymentGateway } = await import('../src/services/payment/paytabs-payment-gateway.ts');

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: PAYMENT_ID },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        currency: true,
        purpose: true,
        provider: true,
        providerRef: true,
        status: true,
        succeededAt: true,
        failedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const booking = await prisma.booking.findUnique({
      where: { id: BOOKING_ID },
      select: {
        id: true,
        publicCode: true,
        status: true,
        paymentState: true,
        paymentCollectionMode: true,
        depositAmount: true,
        remainingAmount: true,
        depositPaidAt: true,
        fullyPaidAt: true,
      },
    });

    const events = await prisma.paymentEvent.findMany({
      where: { paymentId: PAYMENT_ID },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    });

    const gatewayEvents = events.filter(
      (e) => e.action === 'gateway.event' || e.action.startsWith('gateway.') || e.action.includes('webhook'),
    );
    const successEvents = events.filter((e) => e.action === 'payment.succeeded');
    const browserAcks = events.filter((e) => e.action === 'payment.browser_return_ack');

    let queryResult: unknown = null;
    let queryError: string | null = null;
    try {
      const gw = new PayTabsPaymentGateway();
      queryResult = await gw.retrievePayment({
        paymentId: PAYMENT_ID,
        providerRef: TRAN_REF,
      });
    } catch (err) {
      queryError = err instanceof Error ? err.message : String(err);
    }

    const eventSummary = events.map((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      return {
        action: e.action,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        type: meta.type ?? null,
        providerEventId: meta.providerEventId ?? null,
        providerPaymentId: meta.providerPaymentId ?? null,
        hasRaw: Boolean(meta.raw),
        note: meta.note ?? null,
      };
    });

    console.log(
      JSON.stringify(
        redact({
          payment,
          booking,
          eventCount: events.length,
          eventSummary,
          gatewayEventCount: gatewayEvents.length,
          paymentSucceededEventCount: successEvents.length,
          browserReturnAckCount: browserAcks.length,
          queryResult,
          queryError,
        }),
        null,
        2,
      ),
    );
  } finally {
    const { prisma } = await import('@mazare3/db');
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e instanceof Error ? e.message : e) }));
  process.exit(1);
});
