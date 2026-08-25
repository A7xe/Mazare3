/**
 * Focused PayTabs webhook 401 fix checks.
 * Does not create a live PayTabs payment, refund, or mark TST2622902775094 successful.
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(root, '.env'), override: true });

import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { prisma, PaymentStatus, PaymentPurpose, PayoutStatus, BookingStatus, BookingPaymentState } from '@mazare3/db';
import { createApp } from '../src/app.js';
import { loadPaytabsConfig } from '../src/config/paytabs-config.js';
import { providerIdempotencyKey } from '../src/services/payment/payment-provider.interface.js';
import {
  getPaytabsCallbackSignatureHeader,
  parsePaytabsCartId,
  verifyPaytabsCallbackSignature,
} from '../src/services/payment/paytabs-signature.js';

const PROTECTED_PAYMENT_ID = 'cmswzvq0v0001uvdkuqyrqlib';
const PROTECTED_BOOKING_ID = 'cmswzvm1w0005uvuc42bcu3g2';
const PROTECTED_TRAN_REF = 'TST2622902775094';
const PROTECTED_SLOT_ID = 'cmsw7fju0005fuvy8y1amub89';
const PORT = Number(process.env.QA_PAYTABS_WEBHOOK_PORT ?? 4015);
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: unknown) {
  failed++;
  console.log(`  ❌ ${name}: ${String(detail).slice(0, 240)}`);
}

function sign(raw: string, serverKey: string) {
  return createHmac('sha256', serverKey).update(raw, 'utf8').digest('hex');
}

async function postWebhook(raw: string, headers: Record<string, string>) {
  const res = await fetch(`${BASE}/payments/webhooks/paytabs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: raw,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 80) };
  }
  return { status: res.status, json };
}

function prettyPayload(profileId: string, paymentId: string, tranRef: string) {
  return `{
  "profile_id": ${Number(profileId) || JSON.stringify(profileId)},
  "tran_ref": ${JSON.stringify(tranRef)},
  "cart_id": ${JSON.stringify(providerIdempotencyKey(paymentId, 'deposit'))},
  "payment_result": {
    "response_status": "A",
    "response_message": "Authorised",
    "transaction_time": "2026-08-17T09:00:00Z"
  }
}`;
}

const app = createApp();
const server = createServer(app);

await new Promise<void>((resolve, reject) => {
  server.listen(PORT, '127.0.0.1', () => resolve());
  server.on('error', reject);
});

let fixturePaymentId: string | null = null;
let fixtureBookingId: string | null = null;
let fixtureSlotId: string | null = null;

try {
  const cfg = loadPaytabsConfig();
  if (!cfg.configured || !cfg.serverKey || !cfg.profileId) {
    throw new Error('PayTabs is not configured in env');
  }
  const serverKey = cfg.serverKey;
  const profileId = cfg.profileId;

  if (getPaytabsCallbackSignatureHeader({ signature: 'abc' }) === 'abc') {
    pass('Reads PayTabs Signature header (Express lowercase)');
  } else fail('Reads PayTabs Signature header (Express lowercase)', 'missing');

  const spaced = prettyPayload(profileId, 'clqaunknownpaytabs000000001', 'TST_QA_UNKNOWN_1');
  const spacedSig = sign(spaced, serverKey);
  if (verifyPaytabsCallbackSignature(spaced, spacedSig, serverKey)) {
    pass('Signature HMAC over exact raw body');
  } else fail('Signature HMAC over exact raw body', 'rejected');
  const compacted = JSON.stringify(JSON.parse(spaced));
  if (compacted !== spaced && !verifyPaytabsCallbackSignature(compacted, spacedSig, serverKey)) {
    pass('JSON.stringify(parsed) does not match Callback/IPN HMAC');
  } else fail('JSON.stringify(parsed) does not match Callback/IPN HMAC', 'unexpected verify');

  const missing = await postWebhook(spaced, {});
  if (missing.status === 401 && missing.json.code === 'INVALID_WEBHOOK_SIGNATURE') {
    pass('Webhook without JWT and without Signature returns 401');
  } else fail('Webhook without JWT and without Signature returns 401', JSON.stringify(missing));

  const invalid = await postWebhook(spaced, { Signature: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' });
  if (invalid.status === 401 && invalid.json.code === 'INVALID_WEBHOOK_SIGNATURE') {
    pass('Invalid signature still returns 401');
  } else fail('Invalid signature still returns 401', JSON.stringify(invalid));

  const validUnknown = await postWebhook(spaced, { Signature: spacedSig });
  if (
    validUnknown.status === 404 &&
    validUnknown.json.code === 'NOT_FOUND' &&
    validUnknown.status !== 401
  ) {
    pass('Valid signed callback reaches normalized gateway processing');
  } else {
    fail(
      'Valid signed callback reaches normalized gateway processing',
      JSON.stringify(validUnknown),
    );
  }

  const mapped = parsePaytabsCartId(`mazare3_pay_${PROTECTED_PAYMENT_ID}_deposit`);
  const existing = await prisma.payment.findUnique({
    where: { id: PROTECTED_PAYMENT_ID },
    select: {
      id: true,
      bookingId: true,
      amount: true,
      currency: true,
      purpose: true,
      provider: true,
      providerRef: true,
      booking: { select: { publicCode: true } },
    },
  });
  if (
    mapped?.paymentId === PROTECTED_PAYMENT_ID &&
    mapped.purpose === 'deposit' &&
    existing?.provider === 'paytabs' &&
    existing.providerRef === PROTECTED_TRAN_REF &&
    existing.purpose === 'deposit' &&
    Number(existing.amount) === 84 &&
    existing.currency === 'JOD' &&
    existing.bookingId === PROTECTED_BOOKING_ID &&
    existing.booking.publicCode === 'MZ-02618EAB'
  ) {
    pass('Existing-payment callback mapping fixture');
  } else {
    fail('Existing-payment callback mapping fixture', JSON.stringify({ mapped, existing }));
  }

  const donor = await prisma.payment.findFirst({
    where: { id: { not: PROTECTED_PAYMENT_ID } },
    orderBy: { createdAt: 'desc' },
  });
  if (!donor) {
    fail('Duplicate callback remains idempotent', 'no donor payment for fixture');
  } else {
    const fixture = await prisma.payment.create({
      data: {
        bookingId: donor.bookingId,
        userId: donor.userId,
        amount: 1,
        currency: 'JOD',
        method: donor.method,
        purpose: PaymentPurpose.deposit,
        provider: 'paytabs',
        status: PaymentStatus.succeeded,
        bookingTotalAmount: 1,
        customerPayableAmount: 1,
        platformCommissionAmount: 0,
        customerServiceFeeAmount: 0,
        ownerGrossAmount: 0,
        ownerNetPayoutAmount: 0,
        payoutStatus: PayoutStatus.not_ready,
        succeededAt: new Date(),
        idempotencyKey: `qa_paytabs_webhook_${Date.now()}`,
      },
    });
    fixturePaymentId = fixture.id;
    if (fixture.id === PROTECTED_PAYMENT_ID) {
      throw new Error('fixture collided with protected PayTabs payment');
    }

    const dupRaw = prettyPayload(profileId, fixture.id, `TST_QA_DUP_${Date.now()}`);
    const dupSig = sign(dupRaw, serverKey);
    const first = await postWebhook(dupRaw, { Signature: dupSig });
    const second = await postWebhook(dupRaw, { Signature: dupSig });
    const firstData = first.json.data as { message?: string; handled?: boolean } | undefined;
    const secondData = second.json.data as { message?: string; handled?: boolean } | undefined;
    if (
      first.status === 200 &&
      second.status === 200 &&
      firstData?.handled === true &&
      secondData?.handled === true &&
      (secondData.message ?? '').toLowerCase().includes('duplicate')
    ) {
      pass('Duplicate callback remains idempotent');
    } else {
      fail(
        'Duplicate callback remains idempotent',
        JSON.stringify({ first: first.status, second: second.status, firstData, secondData }),
      );
    }
  }

  const slot = await prisma.availabilitySlot.findFirst({
    where: { status: 'available', id: { not: PROTECTED_SLOT_ID } },
    select: { id: true, propertyId: true },
  });
  const user = await prisma.user.findFirst({
    where: { email: 'customer@mazare3.jo' },
    select: { id: true },
  });
  if (!slot || !user) {
    fail('Hold-expired verified callback captures', 'no available slot or customer');
  } else {
    const holdBooking = await prisma.booking.create({
      data: {
        publicCode: `QA${Date.now().toString(36).slice(-8).toUpperCase()}`,
        userId: user.id,
        propertyId: slot.propertyId,
        availabilitySlotId: slot.id,
        guestsCount: 2,
        totalAmount: 20,
        currency: 'JOD',
        status: BookingStatus.expired,
        paymentCollectionMode: 'deposit_balance',
        paymentState: BookingPaymentState.unpaid,
        depositPercent: 30,
        depositAmount: 10,
        remainingAmount: 10,
        platformCommissionPercent: 0,
        platformCommissionAmount: 0,
        ownerNetPayoutAmount: 20,
        customerServiceFeeAmount: 0,
        customerPayableTotal: 20,
        originalSlotPrice: 20,
        holdExpiresAt: new Date(Date.now() - 60_000),
      },
    });
    fixtureBookingId = holdBooking.id;
    fixtureSlotId = slot.id;
    const holdPay = await prisma.payment.create({
      data: {
        bookingId: holdBooking.id,
        userId: user.id,
        amount: 10,
        currency: 'JOD',
        method: 'card',
        purpose: PaymentPurpose.deposit,
        provider: 'paytabs',
        status: PaymentStatus.expired,
        bookingTotalAmount: 20,
        customerPayableAmount: 10,
        platformCommissionAmount: 0,
        customerServiceFeeAmount: 0,
        ownerGrossAmount: 0,
        ownerNetPayoutAmount: 0,
        payoutStatus: PayoutStatus.not_ready,
        providerRef: `TST_QA_HOLD_${Date.now()}`,
        idempotencyKey: `qa_paytabs_hold_${Date.now()}`,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    if (holdPay.id === PROTECTED_PAYMENT_ID || holdBooking.id === PROTECTED_BOOKING_ID) {
      throw new Error('hold fixture collided with protected PayTabs payment');
    }
    const holdRaw = prettyPayload(profileId, holdPay.id, holdPay.providerRef ?? 'TST_QA_HOLD');
    const holdSig = sign(holdRaw, serverKey);
    const holdRes = await postWebhook(holdRaw, { Signature: holdSig });
    const holdData = holdRes.json.data as { message?: string; paymentId?: string } | undefined;
    const captured = await prisma.payment.findUnique({
      where: { id: holdPay.id },
      select: { status: true },
    });
    if (
      holdRes.status === 200 &&
      holdData?.message === 'payment_succeeded applied' &&
      captured?.status === PaymentStatus.succeeded
    ) {
      pass('Hold-expired verified callback captures');
    } else {
      fail('Hold-expired verified callback captures', JSON.stringify({ holdRes, captured }));
    }
  }
} finally {
  if (fixturePaymentId) {
    await prisma.payment.delete({ where: { id: fixturePaymentId } }).catch(() => undefined);
  }
  if (fixtureBookingId) {
    await prisma.booking.delete({ where: { id: fixtureBookingId } }).catch(() => undefined);
  }
  if (fixtureSlotId) {
    await prisma.availabilitySlot
      .update({ where: { id: fixtureSlotId }, data: { status: 'available' } })
      .catch(() => undefined);
  }
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await prisma.$disconnect();
}

console.log(`\n📊 PayTabs webhook callback ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
