/**
 * Phase 10G.2A — PayTabs adapter QA (HTTP mocked; no live PayTabs calls).
 */
import { createHmac } from 'node:crypto';
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

const result = spawnSync(tsxBin, [path.join(ROOT, 'scripts', 'qa-paytabs-adapter-probe.mjs')], {
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
    PAYTABS_RETURN_URL:
      'http://localhost:3000/api/paytabs/browser-return?bookingId={bookingId}&paymentId={paymentId}',
    PAYTABS_CALLBACK_URL: 'http://localhost:4000/api/v1/payments/webhooks/paytabs',
  },
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.status !== 0) process.exit(result.status ?? 1);
