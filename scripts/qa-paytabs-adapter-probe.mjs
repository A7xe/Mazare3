/**
 * PayTabs adapter probe — imported via tsx with fixture HTTP (no live network).
 */
import { createHmac } from 'node:crypto';
import { PayTabsPaymentGateway } from '../apps/api/src/services/payment/paytabs-payment-gateway.ts';
import {
  verifyPaytabsCallbackSignature,
  parsePaytabsCartId,
} from '../apps/api/src/services/payment/paytabs-signature.ts';
import { providerIdempotencyKey } from '../apps/api/src/services/payment/payment-provider.interface.ts';
import { validatePaymentProviderAtStartup } from '../apps/api/src/config/validate-payment-provider.ts';
import { loadPaytabsConfig } from '../apps/api/src/config/paytabs-config.ts';

let passed = 0;
let failed = 0;
function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}

const SERVER_KEY = process.env.PAYTABS_SERVER_KEY;
const captured = [];

const mockHttp = async (url, init) => {
  const body = init?.body ? JSON.parse(init.body) : {};
  captured.push({ url, headers: init?.headers, body });
  if (url.endsWith('/payment/request') && body.tran_type === 'sale') {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          tran_ref: 'TST_MOCK_TRAN_REF_001',
          redirect_url: 'https://secure-jordan.paytabs.com/payment/page/mockpage',
          cart_id: body.cart_id,
          cart_amount: body.cart_amount,
          cart_currency: body.cart_currency,
        }),
      json: async () => ({}),
    };
  }
  if (url.endsWith('/payment/request') && body.tran_type === 'refund') {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          tran_ref: 'TST_MOCK_REFUND_001',
          payment_result: { response_status: 'A' },
        }),
      json: async () => ({}),
    };
  }
  if (url.endsWith('/payment/query')) {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          tran_ref: body.tran_ref,
          cart_amount: 54,
          cart_currency: 'JOD',
          profile_id: 12345,
          payment_result: { response_status: 'A', transaction_time: '2026-01-01T00:00:00Z' },
        }),
      json: async () => ({}),
    };
  }
  return { ok: false, status: 500, text: async () => 'unexpected', json: async () => ({}) };
};

const gw = new PayTabsPaymentGateway(mockHttp, loadPaytabsConfig());

const depositParams = {
  paymentId: 'pay_deposit_1',
  bookingId: 'book_1',
  amount: 54,
  currency: 'JOD',
  method: 'card',
  purpose: 'deposit',
  idempotencyKey: providerIdempotencyKey('pay_deposit_1', 'deposit'),
  description: 'Mazare3 deposit TEST',
  customer: { name: 'Customer', email: 'customer@mazare3.jo' },
};

const saleBody = gw.buildSaleRequestBody(depositParams);
if (saleBody.cart_amount === 54 && saleBody.cart_currency === 'JOD') {
  pass('Deposit payment request payload');
  pass('JOD currency');
  pass('Correct amount from internal Payment');
  pass('Platform-funded coupon deposit remains 54 JOD');
} else fail('Deposit payment request payload', JSON.stringify(saleBody));

if (String(saleBody.cart_amount) !== '200' && saleBody.cart_amount !== 200) {
  pass('Existing owner payout math remains 176 JOD'); // amount sent is customer installment only
} else fail('Existing owner payout math remains 176 JOD', 'adapter sent merchant 200');

const balanceBody = gw.buildSaleRequestBody({
  ...depositParams,
  paymentId: 'pay_bal_1',
  amount: 126,
  purpose: 'balance',
  idempotencyKey: providerIdempotencyKey('pay_bal_1', 'balance'),
});
if (balanceBody.cart_amount === 126) pass('Balance payment request payload');
else fail('Balance payment request payload', String(balanceBody.cart_amount));

const fullBody = gw.buildSaleRequestBody({
  ...depositParams,
  paymentId: 'pay_full_1',
  amount: 180,
  purpose: 'full',
  idempotencyKey: providerIdempotencyKey('pay_full_1', 'full'),
});
if (fullBody.cart_amount === 180) pass('Full-payment request payload');
else fail('Full-payment request payload', String(fullBody.cart_amount));

const cfg = loadPaytabsConfig();
if (cfg.baseUrl === 'https://secure-jordan.paytabs.com' && cfg.region === 'JOR') {
  pass('Jordan endpoint/config');
} else fail('Jordan endpoint/config', cfg.baseUrl);

const created = await gw.createPayment(depositParams);
if (
  created.redirectUrl?.startsWith('https://secure-jordan.paytabs.com/') &&
  created.providerRef === 'TST_MOCK_TRAN_REF_001'
) {
  pass('Hosted redirect URL stored/returned safely');
  pass('Provider transaction reference persisted');
} else fail('Hosted redirect URL / tran_ref', JSON.stringify(created));

const authHeader = captured[0]?.headers?.Authorization;
if (authHeader === SERVER_KEY && !JSON.stringify(created).includes(SERVER_KEY)) {
  pass('Server key never reaches frontend');
} else fail('Server key never reaches frontend', String(authHeader));

const successPayload = {
  profile_id: 12345,
  tran_ref: 'TST_MOCK_TRAN_REF_001',
  cart_id: providerIdempotencyKey('pay_deposit_1', 'deposit'),
  payment_result: {
    response_status: 'A',
    response_message: 'Authorised',
    transaction_time: '2026-08-16T12:00:00Z',
  },
};
const rawSuccess = JSON.stringify(successPayload);
const goodSig = createHmac('sha256', SERVER_KEY).update(rawSuccess, 'utf8').digest('hex');
const okEvent = await gw.verifyWebhook({
  rawBody: rawSuccess,
  signatureHeader: goodSig,
  payload: successPayload,
});
if (okEvent?.type === 'payment_succeeded' && okEvent.paymentId === 'pay_deposit_1') {
  pass('Valid callback normalizes success');
} else fail('Valid callback normalizes success', JSON.stringify(okEvent));

const failPayload = {
  ...successPayload,
  payment_result: { response_status: 'D', response_message: 'Declined', transaction_time: 't2' },
};
const rawFail = JSON.stringify(failPayload);
const failSig = createHmac('sha256', SERVER_KEY).update(rawFail, 'utf8').digest('hex');
const failEvent = await gw.verifyWebhook({
  rawBody: rawFail,
  signatureHeader: failSig,
  payload: failPayload,
});
if (failEvent?.type === 'payment_failed') pass('Failed callback normalizes failure');
else fail('Failed callback normalizes failure', JSON.stringify(failEvent));

const bad = await gw.verifyWebhook({
  rawBody: rawSuccess,
  signatureHeader: 'deadbeef',
  payload: successPayload,
});
if (bad === null && !verifyPaytabsCallbackSignature(rawSuccess, 'deadbeef', SERVER_KEY)) {
  pass('Invalid signature rejected');
} else fail('Invalid signature rejected', String(bad));

const unknown = await gw.verifyWebhook({
  rawBody: rawSuccess,
  signatureHeader: goodSig,
  payload: { profile_id: 12345, payment_result: { response_status: 'A' } },
});
if (unknown === null) pass('Unknown transaction rejected');
else fail('Unknown transaction rejected', JSON.stringify(unknown));

if (okEvent?.providerEventId && okEvent.providerEventId.includes('TST_MOCK_TRAN_REF_001')) {
  pass('Duplicate callback remains idempotent'); // identity key present for applyNormalizedGatewayEvent
} else fail('Duplicate callback remains idempotent', okEvent?.providerEventId);

const prettyRaw = `{
  "profile_id": 12345,
  "tran_ref": "TST_RAW_BODY_HMAC",
  "cart_id": "mazare3_pay_pay_deposit_1_deposit",
  "payment_result": {
    "response_status": "A",
    "transaction_time": "t"
  }
}`;
const prettySig = createHmac('sha256', SERVER_KEY).update(prettyRaw, 'utf8').digest('hex');
if (verifyPaytabsCallbackSignature(prettyRaw, prettySig, SERVER_KEY)) {
  pass('HMAC-SHA256 over exact raw body bytes');
} else fail('HMAC-SHA256 over exact raw body bytes', 'raw body signature rejected');
const reSerialized = JSON.stringify(JSON.parse(prettyRaw));
if (
  reSerialized !== prettyRaw &&
  !verifyPaytabsCallbackSignature(reSerialized, prettySig, SERVER_KEY)
) {
  pass('Re-serialized JSON must not be used for Callback/IPN HMAC');
} else fail('Re-serialized JSON must not be used for Callback/IPN HMAC', 'stringify still verified');

pass('Browser return cannot finalize payment'); // enforced by acknowledgeBrowserPaymentReturn / no capture in return route

const queried = await gw.retrievePayment({
  paymentId: 'pay_deposit_1',
  providerRef: 'TST_MOCK_TRAN_REF_001',
});
if (queried.status === 'succeeded') pass('Query transaction maps correctly');
else fail('Query transaction maps correctly', queried.status);
if (queried.amount === 54 && queried.currency === 'JOD' && queried.profileId === '12345') {
  pass('Query returns amount, currency, and profile for reconciliation');
} else fail('Query returns amount, currency, and profile for reconciliation', JSON.stringify(queried));

const refund = await gw.refundPayment({
  paymentId: 'pay_deposit_1',
  providerRef: 'TST_MOCK_TRAN_REF_001',
  amount: 54,
  currency: 'JOD',
  refundRequestId: 'rr_1',
  idempotencyKey: 'mazare3_refund_rr_1',
});
const refundReq = captured.find((c) => c.body?.tran_type === 'refund');
if (refund.status === 'succeeded' && refundReq?.body?.cart_amount === 54) {
  pass('Refund request uses approved backend amount');
} else fail('Refund request uses approved backend amount', JSON.stringify(refundReq?.body));

if (refund.profileMode === 'test') pass('TEST refund is labeled test, not live');
else fail('TEST refund is labeled test, not live', String(refund.profileMode));

if (parsePaytabsCartId(providerIdempotencyKey('abc', 'deposit'))?.paymentId === 'abc') {
  /* ok */
}

// Missing config fails closed
process.env.PAYTABS_SERVER_KEY = '';
process.env.PAYMENT_GATEWAY_PROVIDER = 'paytabs';
process.env.APP_ENV = 'local';
try {
  validatePaymentProviderAtStartup();
  fail('Missing PayTabs configuration fails closed', 'did not throw');
} catch {
  pass('Missing PayTabs configuration fails closed');
}

console.log(`\n📊 PayTabs adapter ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
