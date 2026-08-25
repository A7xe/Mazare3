/**
 * Safe PayTabs preflight — never prints Server Key.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(root, '.env'), 'utf8');
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (k && process.env[k] == null) process.env[k] = v;
}

function present(k) {
  return Boolean((process.env[k] || '').trim());
}
function maskId(v) {
  const s = String(v || '');
  if (!s) return '(empty)';
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}…${s.slice(-2)} (len=${s.length})`;
}
function redactUrl(u) {
  if (!u) return '(empty)';
  try {
    const url = new URL(u);
    return `${url.protocol}//***/${url.pathname.replace(/^\//, '')}${url.search ? '?…' : ''}`;
  } catch {
    return '(invalid-url)';
  }
}

const gateway = (
  process.env.PAYMENT_GATEWAY_PROVIDER ||
  process.env.PAYMENT_PROVIDER ||
  ''
).trim();
const region = (process.env.PAYTABS_REGION || '').trim();
const currency = (process.env.PAYTABS_CURRENCY || '').trim();
const base = (process.env.PAYTABS_BASE_URL || '').trim();
const ret = (process.env.PAYTABS_RETURN_URL || '').trim();
const cb = (process.env.PAYTABS_CALLBACK_URL || '').trim();
const sim = process.env.PAYMENT_SIMULATE_ENABLED;
const profileOk = present('PAYTABS_PROFILE_ID');
const keyOk = present('PAYTABS_SERVER_KEY');
const cbHttps = cb.startsWith('https://');
const cbLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(cb);
const reachesWebhook = /\/api\/v1\/payments\/webhooks\/paytabs\/?$/i.test(
  cb.split('?')[0] || '',
);

const blockers = [];
if (gateway !== 'paytabs') blockers.push('PAYMENT_GATEWAY_PROVIDER must be paytabs');
if (sim === 'true') blockers.push('PAYMENT_SIMULATE_ENABLED must be false');
if (!profileOk) blockers.push('PAYTABS_PROFILE_ID missing');
if (!keyOk) blockers.push('PAYTABS_SERVER_KEY missing');
if (region && region !== 'JOR') blockers.push('PAYTABS_REGION must be JOR');
if (currency && currency !== 'JOD') blockers.push('PAYTABS_CURRENCY must be JOD');
if (base && !base.includes('secure-jordan.paytabs.com')) {
  blockers.push('PAYTABS_BASE_URL should be Jordan host');
}
if (!ret) blockers.push('PAYTABS_RETURN_URL missing');
if (!cb) blockers.push('PAYTABS_CALLBACK_URL missing');
if (!cbHttps) blockers.push('PAYTABS_CALLBACK_URL must be public HTTPS');
if (cbLocal) blockers.push('PAYTABS_CALLBACK_URL must not be localhost');
if (cb && !reachesWebhook) {
  blockers.push('PAYTABS_CALLBACK_URL must reach /api/v1/payments/webhooks/paytabs');
}

const report = {
  status: blockers.length ? 'BLOCKED' : 'READY',
  PAYMENT_GATEWAY_PROVIDER: gateway || '(unset)',
  PAYMENT_SIMULATE_ENABLED: sim ?? '(unset)',
  PAYTABS_PROFILE_ID_present: profileOk,
  PAYTABS_PROFILE_ID_masked: profileOk ? maskId(process.env.PAYTABS_PROFILE_ID) : null,
  PAYTABS_SERVER_KEY_present: keyOk,
  PAYTABS_SERVER_KEY_length: keyOk ? String(process.env.PAYTABS_SERVER_KEY).length : 0,
  PAYTABS_REGION: region || '(default JOR)',
  PAYTABS_CURRENCY: currency || '(default JOD)',
  PAYTABS_BASE_URL: base || '(default jordan)',
  PAYTABS_RETURN_URL: redactUrl(ret),
  PAYTABS_CALLBACK_URL: redactUrl(cb),
  callback_https: cbHttps,
  callback_localhost: cbLocal,
  callback_path_ok: reachesWebhook,
  blockers,
};

console.log(JSON.stringify(report, null, 2));
process.exit(blockers.length ? 2 : 0);
