/**
 * PayTabs production-safety probe — no live PayTabs network I/O.
 */
import { PayTabsPaymentGateway } from '../apps/api/src/services/payment/paytabs-payment-gateway.ts';
import {
  collectPaytabsLiveUrlErrors,
  collectPaytabsSafetyErrors,
  getPaytabsSafeDiagnostics,
  loadPaytabsConfig,
  redactPaytabsSecrets,
} from '../apps/api/src/config/paytabs-config.ts';

let passed = 0;
let failed = 0;
function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${String(detail).slice(0, 280)}`);
}

const mockHttp = async (url, init) => {
  const body = init?.body ? JSON.parse(init.body) : {};
  if (url.endsWith('/payment/request') && body.tran_type === 'refund') {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          tran_ref: 'TST_MOCK_REFUND_SAFETY',
          payment_result: { response_status: 'A' },
        }),
      json: async () => ({}),
    };
  }
  return { ok: false, status: 500, text: async () => 'unexpected', json: async () => ({}) };
};

const localhostCb = collectPaytabsLiveUrlErrors(
  'http://localhost:4000/api/v1/payments/webhooks/paytabs',
  'PAYTABS_CALLBACK_URL',
);
if (localhostCb.some((e) => e.includes('localhost') || e.includes('HTTPS'))) {
  pass('LIVE URL validation rejects localhost callback');
} else fail('LIVE URL validation rejects localhost callback', localhostCb.join('; '));

const tunnelCb = collectPaytabsLiveUrlErrors(
  'https://random-name.trycloudflare.com/api/v1/payments/webhooks/paytabs',
  'PAYTABS_CALLBACK_URL',
);
if (tunnelCb.some((e) => e.includes('trycloudflare'))) {
  pass('LIVE URL validation rejects trycloudflare callback');
} else fail('LIVE URL validation rejects trycloudflare callback', tunnelCb.join('; '));

const httpReturn = collectPaytabsLiveUrlErrors(
  'http://www.example.com/api/paytabs/browser-return',
  'PAYTABS_RETURN_URL',
);
if (httpReturn.some((e) => e.includes('HTTPS'))) {
  pass('LIVE URL validation rejects HTTP return URL');
} else fail('LIVE URL validation rejects HTTP return URL', httpReturn.join('; '));

const publicOk = collectPaytabsLiveUrlErrors(
  'https://api.example.com/api/v1/payments/webhooks/paytabs',
  'PAYTABS_CALLBACK_URL',
);
if (publicOk.length === 0) pass('LIVE URL validation accepts public HTTPS');
else fail('LIVE URL validation accepts public HTTPS', publicOk.join('; '));

const canary = 'SK_CANARY_DO_NOT_LEAK_9f3a7c';
const redacted = redactPaytabsSecrets(`Authorization: ${canary} pan 4111111111111111`, canary);
if (!redacted.includes(canary) && !redacted.includes('4111111111111111')) {
  pass('Secret redaction strips key and PAN-like digits');
} else fail('Secret redaction strips key and PAN-like digits', redacted);

const diag = getPaytabsSafeDiagnostics(loadPaytabsConfig());
const diagText = JSON.stringify(diag);
if (
  !diagText.includes(process.env.PAYTABS_SERVER_KEY ?? canary) &&
  diag.profileMode &&
  !('serverKey' in diag) &&
  !diagText.toLowerCase().includes('authorization')
) {
  pass('Safe diagnostics omit secrets');
} else fail('Safe diagnostics omit secrets', diagText);

const gw = new PayTabsPaymentGateway(mockHttp, loadPaytabsConfig());
const refund = await gw.refundPayment({
  paymentId: 'pay_safety_1',
  providerRef: 'TST_MOCK_TRAN_REF_001',
  amount: 20,
  currency: 'JOD',
  refundRequestId: 'rr_safety',
  idempotencyKey: 'mazare3_refund_rr_safety',
});
if (refund.profileMode === 'test' && refund.profileMode !== 'live') {
  pass('Refund provider-mode isolation (TEST not presented as LIVE)');
} else fail('Refund provider-mode isolation (TEST not presented as LIVE)', String(refund.profileMode));

process.env.PAYTABS_PROFILE_MODE = 'live';
process.env.APP_ENV = 'local';
process.env.PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION = '';
process.env.PAYTABS_CALLBACK_URL = 'https://api.example.com/api/v1/payments/webhooks/paytabs';
process.env.PAYTABS_RETURN_URL = 'https://www.example.com/api/paytabs/browser-return';
process.env.PAYTABS_PROFILE_ID = '12345';
process.env.PAYTABS_SERVER_KEY = 'test_server_key_not_real';
const liveLocalErrors = collectPaytabsSafetyErrors(loadPaytabsConfig(), {
  paytabsSelected: true,
  appEnv: 'local',
});
if (liveLocalErrors.some((e) => e.includes('PAYTABS_PROFILE_MODE=live is blocked'))) {
  pass('LIVE refund/sale blocked in local without override');
} else fail('LIVE refund/sale blocked in local without override', liveLocalErrors.join('; '));

try {
  new PayTabsPaymentGateway(mockHttp, loadPaytabsConfig());
  fail('LIVE gateway constructor blocked in local', 'did not throw');
} catch {
  pass('LIVE gateway constructor blocked in local');
}

process.env.PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION = 'true';
try {
  const liveGw = new PayTabsPaymentGateway(mockHttp, loadPaytabsConfig());
  const liveRefund = await liveGw.refundPayment({
    paymentId: 'pay_safety_1',
    providerRef: 'TST_MOCK_TRAN_REF_001',
    amount: 20,
    currency: 'JOD',
    refundRequestId: 'rr_live',
    idempotencyKey: 'mazare3_refund_rr_live',
  });
  if (liveRefund.profileMode === 'live') pass('Override LIVE refund is labeled live, not test');
  else fail('Override LIVE refund is labeled live, not test', String(liveRefund.profileMode));
} catch (err) {
  fail('Override LIVE refund is labeled live, not test', err instanceof Error ? err.message : err);
}

console.log(`\n📊 PayTabs production-safety probe ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
