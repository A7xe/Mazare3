/**
 * Phase 10G.2C-A — PayTabs production payment safety QA.
 * No live PayTabs network calls.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsxBin = path.join(
  ROOT,
  'apps',
  'api',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.CMD' : 'tsx',
);

let passed = 0;
let failed = 0;
function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${String(detail).slice(0, 360)}`);
}

const CANARY_KEY = 'SK_CANARY_DO_NOT_LEAK_9f3a7c';
const CANARY_PROFILE = 'PID_CANARY_DO_NOT_LEAK';

const TEST_URLS = {
  PAYTABS_RETURN_URL:
    'http://localhost:3000/api/paytabs/browser-return?bookingId={bookingId}&paymentId={paymentId}',
  PAYTABS_CALLBACK_URL: 'http://localhost:4000/api/v1/payments/webhooks/paytabs',
};

const LIVE_URLS = {
  PAYTABS_RETURN_URL: 'https://www.example.com/api/paytabs/browser-return?bookingId={bookingId}&paymentId={paymentId}',
  PAYTABS_CALLBACK_URL: 'https://api.example.com/api/v1/payments/webhooks/paytabs',
};

function probeStartup(overrides) {
  const result = spawnSync(tsxBin, [path.join(ROOT, 'scripts', 'qa-payment-gateway-startup-probe.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      APP_ENV: 'local',
      PAYMENT_GATEWAY_PROVIDER: 'paytabs',
      PAYMENT_PROVIDER: 'paytabs',
      PAYMENT_SIMULATE_ENABLED: 'false',
      DISABLE_AUTH_RATE_LIMIT: 'false',
      ENABLE_INTERNAL_QA_ROUTES: 'false',
      PAYTABS_PROFILE_MODE: 'test',
      PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION: '',
      PAYTABS_PROFILE_ID: '12345',
      PAYTABS_SERVER_KEY: CANARY_KEY,
      PAYTABS_REGION: 'JOR',
      PAYTABS_CURRENCY: 'JOD',
      PAYTABS_BASE_URL: 'https://secure-jordan.paytabs.com',
      ...TEST_URLS,
      ...overrides,
    },
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    ok: result.status === 0 && out.includes('OK'),
    failedClosed: result.status !== 0 && out.includes('ERR:'),
    out,
  };
}

function secretsLeaked(out) {
  return out.includes(CANARY_KEY) || out.includes(CANARY_PROFILE);
}

console.log('\n🔒 Phase 10G.2C-A PayTabs production payment safety\n');

const localTest = probeStartup({
  APP_ENV: 'local',
  PAYTABS_PROFILE_MODE: 'test',
  PAYMENT_GATEWAY_PROVIDER: 'paytabs',
});
if (localTest.ok && !secretsLeaked(localTest.out)) pass('Local + test mode starts');
else fail('Local + test mode starts', localTest.out);

const prodTest = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'test',
  PAYMENT_GATEWAY_PROVIDER: 'paytabs',
  PAYTABS_PROFILE_ID: CANARY_PROFILE,
  PAYTABS_SERVER_KEY: CANARY_KEY,
});
if (prodTest.failedClosed && prodTest.out.includes('PAYTABS_PROFILE_MODE=live') && !secretsLeaked(prodTest.out)) {
  pass('Production + test mode fails closed');
} else fail('Production + test mode fails closed', prodTest.out);

const prodMock = probeStartup({
  APP_ENV: 'production',
  PAYMENT_GATEWAY_PROVIDER: 'mock',
  PAYMENT_PROVIDER: 'test',
  PAYTABS_PROFILE_MODE: 'test',
});
if (prodMock.failedClosed && /mock|test/i.test(prodMock.out) && !secretsLeaked(prodMock.out)) {
  pass('Production + mock fails closed when payments require PayTabs');
} else fail('Production + mock fails closed when payments require PayTabs', prodMock.out);

const liveLocalhost = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'live',
  PAYTABS_CALLBACK_URL: 'http://localhost:4000/api/v1/payments/webhooks/paytabs',
  PAYTABS_RETURN_URL: LIVE_URLS.PAYTABS_RETURN_URL,
});
if (
  liveLocalhost.failedClosed &&
  liveLocalhost.out.includes('PAYTABS_CALLBACK_URL') &&
  !secretsLeaked(liveLocalhost.out)
) {
  pass('Production LIVE rejects localhost callback');
} else fail('Production LIVE rejects localhost callback', liveLocalhost.out);

const liveTunnel = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'live',
  PAYTABS_CALLBACK_URL: 'https://random-name.trycloudflare.com/api/v1/payments/webhooks/paytabs',
  PAYTABS_RETURN_URL: LIVE_URLS.PAYTABS_RETURN_URL,
});
if (
  liveTunnel.failedClosed &&
  liveTunnel.out.includes('trycloudflare') &&
  !secretsLeaked(liveTunnel.out)
) {
  pass('Production LIVE rejects trycloudflare callback');
} else fail('Production LIVE rejects trycloudflare callback', liveTunnel.out);

const liveHttpReturn = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'live',
  ...LIVE_URLS,
  PAYTABS_RETURN_URL: 'http://www.example.com/api/paytabs/browser-return',
});
if (
  liveHttpReturn.failedClosed &&
  liveHttpReturn.out.includes('PAYTABS_RETURN_URL') &&
  liveHttpReturn.out.includes('HTTPS') &&
  !secretsLeaked(liveHttpReturn.out)
) {
  pass('Production LIVE rejects HTTP return URL');
} else fail('Production LIVE rejects HTTP return URL', liveHttpReturn.out);

const missingLive = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'live',
  ...LIVE_URLS,
  PAYTABS_PROFILE_ID: '',
  PAYTABS_SERVER_KEY: '',
});
if (missingLive.failedClosed && !secretsLeaked(missingLive.out)) {
  pass('Missing LIVE credentials fail closed');
} else fail('Missing LIVE credentials fail closed', missingLive.out);

const simProd = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'live',
  ...LIVE_URLS,
  PAYMENT_SIMULATE_ENABLED: 'true',
});
if (
  simProd.failedClosed &&
  simProd.out.includes('PAYMENT_SIMULATE_ENABLED') &&
  !secretsLeaked(simProd.out)
) {
  pass('Simulation enabled in production fails closed');
} else fail('Simulation enabled in production fails closed', simProd.out);

const liveLocal = probeStartup({
  APP_ENV: 'local',
  PAYTABS_PROFILE_MODE: 'live',
  ...LIVE_URLS,
});
if (
  liveLocal.failedClosed &&
  liveLocal.out.includes('PAYTABS_PROFILE_MODE=live is blocked') &&
  !secretsLeaked(liveLocal.out)
) {
  pass('LIVE profile blocked in local environment by default');
} else fail('LIVE profile blocked in local environment by default', liveLocal.out);

const secretScanSources = [
  prodTest,
  liveLocalhost,
  liveTunnel,
  liveHttpReturn,
  missingLive,
  simProd,
  liveLocal,
];
if (secretScanSources.every((r) => !secretsLeaked(r.out))) {
  pass('Secrets are absent from startup errors/logs');
} else fail('Secrets are absent from startup errors/logs', 'canary leaked');

const prodLiveOk = probeStartup({
  APP_ENV: 'production',
  PAYTABS_PROFILE_MODE: 'live',
  ...LIVE_URLS,
  PAYMENT_SIMULATE_ENABLED: 'false',
  DISABLE_AUTH_RATE_LIMIT: 'false',
  ENABLE_INTERNAL_QA_ROUTES: 'false',
});
if (prodLiveOk.ok && !secretsLeaked(prodLiveOk.out)) {
  pass('Production LIVE with public HTTPS starts');
} else fail('Production LIVE with public HTTPS starts', prodLiveOk.out);

const probe = spawnSync(tsxBin, [path.join(ROOT, 'scripts', 'qa-paytabs-production-safety-probe.mjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    APP_ENV: 'local',
    PAYTABS_PROFILE_MODE: 'test',
    PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION: '',
    PAYTABS_PROFILE_ID: '12345',
    PAYTABS_SERVER_KEY: 'test_server_key_not_real',
    PAYTABS_REGION: 'JOR',
    PAYTABS_CURRENCY: 'JOD',
    PAYTABS_BASE_URL: 'https://secure-jordan.paytabs.com',
    ...TEST_URLS,
  },
});
process.stdout.write(probe.stdout || '');
process.stderr.write(probe.stderr || '');
if (probe.status === 0) pass('Refund provider-mode isolation probe');
else fail('Refund provider-mode isolation probe', `exit ${probe.status}`);

console.log(`\n📊 PayTabs production safety ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
