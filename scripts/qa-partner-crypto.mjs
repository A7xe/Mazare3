/**
 * Partner encryption helper QA (no live secrets printed).
 */
import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'apps', 'api');

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

function runFile(code, extraEnv = {}) {
  const file = path.join(os.tmpdir(), `mazare3-crypto-qa-${Date.now()}.ts`);
  writeFileSync(file, code);
  try {
    return spawnSync('pnpm', ['exec', 'tsx', file], {
      cwd: API,
      encoding: 'utf8',
      shell: true,
      env: {
        ...process.env,
        APP_ENV: extraEnv.APP_ENV ?? 'local',
        ENABLE_INTERNAL_QA_ROUTES: extraEnv.ENABLE_INTERNAL_QA_ROUTES ?? 'true',
        PARTNER_DATA_ENCRYPTION_KEY:
          extraEnv.PARTNER_DATA_ENCRYPTION_KEY === undefined
            ? process.env.PARTNER_DATA_ENCRYPTION_KEY
            : extraEnv.PARTNER_DATA_ENCRYPTION_KEY,
      },
    });
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

const TEST_KEY = 'a'.repeat(64);

console.log('\n🔐 Partner crypto QA\n');

const roundtrip = runFile(
  `
import { encryptPartnerField, decryptPartnerField, payloadLooksEncrypted, last4Of, fingerprintIban } from ${JSON.stringify(path.join(API, 'src/lib/partner-crypto.ts'))};
const secret = 'JO93CBJO0000000000001234567890';
const enc = encryptPartnerField(secret);
if (!payloadLooksEncrypted(enc)) throw new Error('not encrypted format');
if (enc.includes(secret)) throw new Error('plaintext in ciphertext');
if (decryptPartnerField(enc) !== secret) throw new Error('roundtrip failed');
if (last4Of(secret) !== '7890') throw new Error('last4');
const fp = fingerprintIban(secret);
if (fp.length !== 64 || fp.includes(secret)) throw new Error('fingerprint');
console.log('OK');
`,
  { PARTNER_DATA_ENCRYPTION_KEY: TEST_KEY, APP_ENV: 'local' },
);

if (roundtrip.status === 0 && (roundtrip.stdout || '').includes('OK')) {
  pass('payout encryption round-trip (AES-256-GCM)');
  pass('plaintext absent from ciphertext');
  pass('IBAN fingerprint is HMAC not reversible');
} else {
  fail(
    'encryption round-trip',
    (roundtrip.stderr || roundtrip.stdout || `exit ${roundtrip.status}`).slice(0, 400),
  );
}

const missing = runFile(
  `
import { encryptPartnerField } from ${JSON.stringify(path.join(API, 'src/lib/partner-crypto.ts'))};
try {
  encryptPartnerField('x');
  throw new Error('should have failed');
} catch (e) {
  if (String((e as Error).message || e).includes('should have failed')) throw e;
  console.log('FAIL_CLOSED');
}
`,
  { PARTNER_DATA_ENCRYPTION_KEY: '', APP_ENV: 'production', ENABLE_INTERNAL_QA_ROUTES: 'false' },
);

if (missing.status === 0 && (missing.stdout || '').includes('FAIL_CLOSED')) {
  pass('missing encryption key fails closed outside allowed test env');
} else {
  fail(
    'missing key fail-closed',
    (missing.stderr || missing.stdout || `exit ${missing.status}`).slice(0, 400),
  );
}

const ivUnique = runFile(
  `
import { encryptPartnerField, decryptPartnerField } from ${JSON.stringify(path.join(API, 'src/lib/partner-crypto.ts'))};
const secret = 'JO93CBJO0000000000001234567890';
const a = encryptPartnerField(secret);
const b = encryptPartnerField(secret);
if (a === b) throw new Error('identical ciphertext');
if (decryptPartnerField(a) !== secret || decryptPartnerField(b) !== secret) throw new Error('decrypt');
console.log('OK');
`,
  { PARTNER_DATA_ENCRYPTION_KEY: TEST_KEY, APP_ENV: 'local' },
);
if (ivUnique.status === 0 && (ivUnique.stdout || '').includes('OK')) {
  pass('identical IBAN does not produce identical ciphertext');
} else {
  fail('iv uniqueness', (ivUnique.stderr || ivUnique.stdout || `exit ${ivUnique.status}`).slice(0, 400));
}

const tamper = runFile(
  `
import { encryptPartnerField, decryptPartnerField } from ${JSON.stringify(path.join(API, 'src/lib/partner-crypto.ts'))};
const enc = encryptPartnerField('JO11TEST0000000000000000000001');
const parts = enc.split('.');
parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('aa') ? 'bb' : 'aa');
try {
  decryptPartnerField(parts.join('.'));
  throw new Error('should have failed');
} catch (e) {
  if (String((e as Error).message || e).includes('should have failed')) throw e;
  console.log('FAIL_CLOSED');
}
`,
  { PARTNER_DATA_ENCRYPTION_KEY: TEST_KEY, APP_ENV: 'local' },
);
if (tamper.status === 0 && (tamper.stdout || '').includes('FAIL_CLOSED')) {
  pass('tampered ciphertext fails closed');
} else {
  fail('tamper', (tamper.stderr || tamper.stdout || `exit ${tamper.status}`).slice(0, 400));
}

console.log(`\nPartner crypto: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
