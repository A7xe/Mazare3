/**
 * Partner private-document storage QA (no live cloud credentials required).
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
  const file = path.join(os.tmpdir(), `mazare3-storage-qa-${Date.now()}-${Math.random().toString(16).slice(2)}.ts`);
  writeFileSync(file, code);
  try {
    return spawnSync('pnpm', ['exec', 'tsx', file], {
      cwd: API,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, ...extraEnv },
    });
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

console.log('\n🗄️  Partner document storage QA\n');

const prodLocal = runFile(
  `
import { loadPartnerDocumentStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/partner-document-storage.config.ts'))};
try {
  loadPartnerDocumentStorageConfig();
  throw new Error('should have failed');
} catch (e) {
  if (String((e as Error).message || e).includes('should have failed')) throw e;
  console.log('FAIL_CLOSED');
}
`,
  {
    APP_ENV: 'production',
    PARTNER_DOCUMENT_STORAGE_PROVIDER: 'local_private',
  },
);
if (prodLocal.status === 0 && (prodLocal.stdout || '').includes('FAIL_CLOSED')) {
  pass('production + local_private fails closed');
} else {
  fail('production local_private', (prodLocal.stderr || prodLocal.stdout || `exit ${prodLocal.status}`).slice(0, 400));
}

const incompleteS3 = runFile(
  `
import { loadPartnerDocumentStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/partner-document-storage.config.ts'))};
try {
  loadPartnerDocumentStorageConfig();
  throw new Error('should have failed');
} catch (e) {
  const msg = String((e as Error).message || e);
  if (msg.includes('should have failed')) throw e;
  if (msg.includes('AKIA') || msg.includes('secret')) throw new Error('secret leaked');
  console.log('FAIL_CLOSED');
}
`,
  {
    APP_ENV: 'production',
    PARTNER_DOCUMENT_STORAGE_PROVIDER: 's3_private',
    PARTNER_DOCUMENT_S3_REGION: '',
    PARTNER_DOCUMENT_S3_BUCKET: '',
    PARTNER_DOCUMENT_S3_ACCESS_KEY_ID: '',
    PARTNER_DOCUMENT_S3_SECRET_ACCESS_KEY: '',
  },
);
if (incompleteS3.status === 0 && (incompleteS3.stdout || '').includes('FAIL_CLOSED')) {
  pass('incomplete s3_private config fails closed without leaking secrets');
} else {
  fail('incomplete s3', (incompleteS3.stderr || incompleteS3.stdout || `exit ${incompleteS3.status}`).slice(0, 400));
}

const incompleteR2 = runFile(
  `
import { loadPartnerDocumentStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/partner-document-storage.config.ts'))};
try {
  loadPartnerDocumentStorageConfig();
  throw new Error('should have failed');
} catch (e) {
  const msg = String((e as Error).message || e);
  if (msg.includes('should have failed')) throw e;
  if (msg.includes('secret') && /sk-|AKIA/.test(msg)) throw new Error('secret leaked');
  console.log('FAIL_CLOSED');
}
`,
  {
    APP_ENV: 'production',
    PARTNER_DOCUMENT_STORAGE_PROVIDER: 'cloudflare_r2_private',
    CLOUDFLARE_R2_ACCOUNT_ID: '',
    CLOUDFLARE_R2_BUCKET: '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: '',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: '',
  },
);
if (incompleteR2.status === 0 && (incompleteR2.stdout || '').includes('FAIL_CLOSED')) {
  pass('incomplete cloudflare_r2_private config fails closed without leaking secrets');
} else {
  fail('incomplete r2', (incompleteR2.stderr || incompleteR2.stdout || `exit ${incompleteR2.status}`).slice(0, 400));
}

const r2Endpoint = runFile(
  `
import { loadPartnerDocumentStorageConfig, cloudflareR2S3Endpoint } from ${JSON.stringify(path.join(API, 'src/config/partner-document-storage.config.ts'))};
const derived = cloudflareR2S3Endpoint('acct123');
if (derived !== 'https://acct123.r2.cloudflarestorage.com') throw new Error('endpoint');
const cfg = loadPartnerDocumentStorageConfig();
if (cfg.provider !== 'cloudflare_r2_private') throw new Error('provider');
if (cfg.s3?.bucket !== 'mazare3-kyc-private') throw new Error('bucket');
if (cfg.s3?.endpoint !== 'https://acct123.r2.cloudflarestorage.com') throw new Error('derived endpoint');
if (cfg.s3?.region !== 'auto') throw new Error('region');
console.log('OK');
`,
  {
    APP_ENV: 'production',
    PARTNER_DOCUMENT_STORAGE_PROVIDER: 'cloudflare_r2_private',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_R2_BUCKET: 'mazare3-kyc-private',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2secret',
  },
);
if (r2Endpoint.status === 0 && (r2Endpoint.stdout || '').includes('OK')) {
  pass('R2 S3 endpoint is derived from CLOUDFLARE_R2_ACCOUNT_ID');
} else {
  fail('r2 endpoint', (r2Endpoint.stderr || r2Endpoint.stdout || `exit ${r2Endpoint.status}`).slice(0, 400));
}

const adapters = runFile(
  `
import { MemoryPrivateDocumentStorage } from ${JSON.stringify(path.join(API, 'src/services/partner-documents/memory-private-storage.ts'))};
import { S3PrivateDocumentStorage } from ${JSON.stringify(path.join(API, 'src/services/partner-documents/s3-private-storage.ts'))};

async function main() {
  const mem = new MemoryPrivateDocumentStorage();
  await mem.put({ storageKey: 'owner-a/file.png', mimeType: 'image/png', body: Buffer.from('abc') });
  const got = await mem.get('owner-a/file.png');
  if (got.toString() !== 'abc') throw new Error('memory get');
  await mem.delete('owner-a/file.png');
  try {
    await mem.get('owner-a/file.png');
    throw new Error('should 404');
  } catch (e) {
    if (String((e as Error).message).includes('should 404')) throw e;
  }
  mem.failNextPut = true;
  try {
    await mem.put({ storageKey: 'x', mimeType: 'image/png', body: Buffer.from('z') });
    throw new Error('put should fail');
  } catch (e) {
    if (String((e as Error).message).includes('put should fail')) throw e;
  }

  const calls: any[] = [];
  const fakeClient = {
    send: async (cmd: any) => {
      const input = cmd.input ?? cmd;
      calls.push(input);
      if (input?.Body) return {};
      if (input?.Key) {
        return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
      }
      return {};
    },
  };
  const s3 = new S3PrivateDocumentStorage(
    {
      region: 'auto',
      bucket: 'private-kyc',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
    },
    fakeClient as any,
  );
  await s3.put({ storageKey: 'oid/doc.pdf', mimeType: 'application/pdf', body: Buffer.from('%PDF') });
  if (calls[0]?.ACL) throw new Error('must not set public or any ACL');
  if (calls[0]?.Bucket !== 'private-kyc') throw new Error('bucket');
  if (calls[0]?.ContentType !== 'application/pdf') throw new Error('content-type');
  await s3.get('oid/doc.pdf');
  await s3.delete('oid/doc.pdf');

  const r2 = new S3PrivateDocumentStorage(
    {
      region: 'auto',
      bucket: 'mazare3-kyc-private',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
      endpoint: 'https://acct123.r2.cloudflarestorage.com',
    },
    fakeClient as any,
    'cloudflare_r2_private',
  );
  if (r2.providerName !== 'cloudflare_r2_private') throw new Error('r2 name');
  await r2.put({ storageKey: 'oid/id.png', mimeType: 'image/png', body: Buffer.from('png') });
  const r2Put = calls.find((c) => c.Key === 'oid/id.png');
  if (!r2Put || r2Put.ACL) throw new Error('r2 acl');
  if (r2Put.Bucket !== 'mazare3-kyc-private') throw new Error('r2 bucket');
  if (r2Put.ContentType !== 'image/png') throw new Error('r2 content-type');

  const mem2 = new MemoryPrivateDocumentStorage();
  await mem2.put({ storageKey: 'prev/doc.pdf', mimeType: 'application/pdf', body: Buffer.from('old') });
  mem2.failNextPut = true;
  try {
    await mem2.put({ storageKey: 'next/doc.pdf', mimeType: 'application/pdf', body: Buffer.from('new') });
    throw new Error('replacement put should fail');
  } catch (e) {
    if (String((e as Error).message).includes('replacement put should fail')) throw e;
  }
  const kept = await mem2.get('prev/doc.pdf');
  if (kept.toString() !== 'old') throw new Error('previous object lost');
  await mem2.put({ storageKey: 'orphan/doc.pdf', mimeType: 'application/pdf', body: Buffer.from('tmp') });
  await mem2.delete('orphan/doc.pdf');
  try {
    await mem2.get('orphan/doc.pdf');
    throw new Error('orphan should be gone');
  } catch (e) {
    if (String((e as Error).message).includes('orphan should be gone')) throw e;
  }
  console.log('OK');
}
main();
`,
  { APP_ENV: 'local' },
);
if (adapters.status === 0 && (adapters.stdout || '').includes('OK')) {
  pass('memory adapter put/get/delete and fail-put');
  pass('s3_private adapter uses mocked client without public ACL');
  pass('cloudflare_r2_private mocked put/get uses private bucket and Content-Type');
  pass('failed replacement put preserves previous object; delete cleans orphan');
} else {
  fail('adapters', (adapters.stderr || adapters.stdout || `exit ${adapters.status}`).slice(0, 500));
}

console.log(`\nPartner storage: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
