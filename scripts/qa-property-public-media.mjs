/**
 * Phase 10H.1 — Public property media (Cloudflare R2 public) focused QA.
 * Config/storage probes use tsx + mocked S3 (no live R2). Live API tests hit local :4000.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'apps', 'api');
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';

const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const SAMPLE_URL = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80';

const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc000000301010018dd8db40000000049454e44ae426082',
  'hex',
);

let passed = 0;
let failed = 0;
const failures = [];
let cookieJar = '';

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  ❌ ${name}: ${detail}`);
}

function runFile(code, extraEnv = {}) {
  const file = path.join(
    os.tmpdir(),
    `mazare3-public-media-qa-${Date.now()}-${Math.random().toString(16).slice(2)}.ts`,
  );
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

function expectOk(label, result) {
  if (result.status === 0 && (result.stdout || '').includes('OK')) {
    pass(label);
    return;
  }
  fail(label, (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 500));
}

async function api(method, pathName, body, useCookie = true, headers = {}) {
  const h = { ...headers };
  if (body && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
  }
  if (useCookie && cookieJar) h.Cookie = cookieJar;

  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: h,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

function pngForm(filename = 'farm.png', type = 'image/png') {
  const fd = new FormData();
  fd.append('file', new Blob([PNG_1X1], { type }), filename);
  return fd;
}

console.log('\n🖼️  Phase 10H.1 public property media QA\n');

const fallbackLocal = runFile(
  `
import { loadPropertyMediaStorageProvider } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
const p = loadPropertyMediaStorageProvider();
if (p !== 'local') throw new Error('expected local fallback, got ' + p);
console.log('OK');
`,
  {
    PROPERTY_MEDIA_STORAGE_PROVIDER: '',
    MEDIA_PROVIDER: 'local',
  },
);
expectOk('unset PROPERTY_MEDIA_STORAGE_PROVIDER falls back to MEDIA_PROVIDER=local', fallbackLocal);

const dedicated = runFile(
  `
import { loadPropertyMediaStorageProvider } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
const p = loadPropertyMediaStorageProvider();
if (p !== 'cloudflare_r2_public') throw new Error(p);
console.log('OK');
`,
  { PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public', MEDIA_PROVIDER: 'local' },
);
expectOk('PROPERTY_MEDIA_STORAGE_PROVIDER=cloudflare_r2_public is selected over MEDIA_PROVIDER', dedicated);

const incomplete = runFile(
  `
import { loadPropertyMediaStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
try {
  loadPropertyMediaStorageConfig();
  throw new Error('should have failed');
} catch (e) {
  const msg = String((e as Error).message || e);
  if (msg.includes('should have failed')) throw e;
  if (/[0-9a-f]{32}/i.test(msg) || msg.includes('secret') && /AKIA|sk-/.test(msg)) throw new Error('secret leaked');
  console.log('OK');
}
`,
  {
    PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public',
    CLOUDFLARE_R2_ACCOUNT_ID: '',
    CLOUDFLARE_R2_MEDIA_BUCKET: '',
    CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID: '',
    CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY: '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: '',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: '',
    CLOUDFLARE_R2_MEDIA_PUBLIC_URL: '',
  },
);
expectOk('incomplete cloudflare_r2_public fails closed without leaking secrets', incomplete);

const sameBucket = runFile(
  `
import { loadPropertyMediaStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
try {
  loadPropertyMediaStorageConfig();
  throw new Error('should have failed');
} catch (e) {
  const msg = String((e as Error).message || e);
  if (msg.includes('should have failed')) throw e;
  if (!msg.includes('must not equal CLOUDFLARE_R2_BUCKET')) throw new Error(msg);
  console.log('OK');
}
`,
  {
    PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_R2_BUCKET: 'shared-bucket',
    CLOUDFLARE_R2_MEDIA_BUCKET: 'shared-bucket',
    CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID: '',
    CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY: '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2secret',
    CLOUDFLARE_R2_MEDIA_PUBLIC_URL: 'https://media.example.test',
  },
);
expectOk('public media bucket cannot equal private KYC bucket', sameBucket);

const r2Cfg = runFile(
  `
import { loadPropertyMediaStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
const cfg = loadPropertyMediaStorageConfig();
if (cfg.provider !== 'cloudflare_r2_public') throw new Error('provider');
if (cfg.r2?.bucket !== 'public-media-bucket') throw new Error('bucket');
if (cfg.r2?.publicBaseUrl !== 'https://cdn.example.test') throw new Error('public url');
if (cfg.r2?.endpoint !== 'https://acct123.r2.cloudflarestorage.com') throw new Error('endpoint');
if (cfg.r2?.credentialSource !== 'shared_fallback') throw new Error('source');
console.log('OK');
`,
  {
    PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_R2_BUCKET: 'private-kyc-bucket',
    CLOUDFLARE_R2_MEDIA_BUCKET: 'public-media-bucket',
    CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID: '',
    CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY: '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2secret',
    CLOUDFLARE_R2_MEDIA_PUBLIC_URL: 'https://cdn.example.test/',
  },
);
expectOk('R2 public config uses MEDIA bucket + public URL, not KYC bucket', r2Cfg);

const dedicatedWins = runFile(
  `
import { loadPropertyMediaStorageConfig, getPublicPropertyMediaSafeDiagnostics } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
const cfg = loadPropertyMediaStorageConfig();
if (cfg.r2?.credentialSource !== 'dedicated_media') throw new Error('source');
if (cfg.r2?.accessKeyId !== 'media-access') throw new Error('did not prefer dedicated media key');
const diag = getPublicPropertyMediaSafeDiagnostics();
if (diag.credentialSource !== 'dedicated_media') throw new Error('diag source');
if (diag.mediaCredentialsConfigured !== true) throw new Error('diag configured');
if (diag.mediaBucket !== 'public-media-bucket') throw new Error('diag bucket');
if (diag.publicUrlHost !== 'cdn.example.test') throw new Error('diag host');
const dumped = JSON.stringify(diag);
if (dumped.includes('media-access') || dumped.includes('media-secret') || dumped.includes('kyc-secret')) throw new Error('secret leaked');
console.log('OK');
`,
  {
    PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_R2_BUCKET: 'private-kyc-bucket',
    CLOUDFLARE_R2_MEDIA_BUCKET: 'public-media-bucket',
    CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID: 'media-access',
    CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY: 'media-secret',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'kyc-access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'kyc-secret',
    CLOUDFLARE_R2_MEDIA_PUBLIC_URL: 'https://cdn.example.test',
  },
);
expectOk('dedicated MEDIA credentials take precedence over shared KYC keys', dedicatedWins);

const incompleteDedicated = runFile(
  `
import { loadPropertyMediaStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
try {
  loadPropertyMediaStorageConfig();
  throw new Error('should have failed');
} catch (e) {
  const msg = String((e as Error).message || e);
  if (msg.includes('should have failed')) throw e;
  if (!msg.includes('CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY')) throw new Error(msg);
  if (msg.includes('media-access') || msg.includes('kyc-secret')) throw new Error('secret leaked');
  console.log('OK');
}
`,
  {
    PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_R2_MEDIA_BUCKET: 'public-media-bucket',
    CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID: 'media-access',
    CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY: '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'kyc-access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'kyc-secret',
    CLOUDFLARE_R2_MEDIA_PUBLIC_URL: 'https://cdn.example.test',
  },
);
expectOk('incomplete dedicated MEDIA pair fails closed and does not mix KYC secret', incompleteDedicated);

const kycUntouched = runFile(
  `
import { loadPartnerDocumentStorageConfig } from ${JSON.stringify(path.join(API, 'src/config/partner-document-storage.config.ts'))};
const cfg = loadPartnerDocumentStorageConfig();
if (cfg.provider !== 'cloudflare_r2_private') throw new Error('provider');
if (cfg.s3?.bucket !== 'private-kyc-bucket') throw new Error('kyc bucket changed');
if (cfg.s3?.accessKeyId !== 'r2access') throw new Error('kyc credentials changed');
console.log('OK');
`,
  {
    APP_ENV: 'local',
    PARTNER_DOCUMENT_STORAGE_PROVIDER: 'cloudflare_r2_private',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_R2_BUCKET: 'private-kyc-bucket',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'r2secret',
    PROPERTY_MEDIA_STORAGE_PROVIDER: 'cloudflare_r2_public',
    CLOUDFLARE_R2_MEDIA_BUCKET: 'public-media-bucket',
    CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID: 'media-access',
    CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY: 'media-secret',
    CLOUDFLARE_R2_MEDIA_PUBLIC_URL: 'https://cdn.example.test',
  },
);
expectOk('private KYC storage still uses CLOUDFLARE_R2_BUCKET', kycUntouched);

const keysAndUrls = runFile(
  `
import { randomUUID } from 'crypto';
import {
  isPublicR2MediaKey,
  isLocalDevMediaKey,
  buildPublicPropertyMediaUrl,
  peekPublicMediaBaseUrl,
} from ${JSON.stringify(path.join(API, 'src/config/property-media-storage.config.ts'))};
import { resolvePropertyMediaPublicUrl } from ${JSON.stringify(path.join(API, 'src/lib/property-media-public-url.ts'))};
import { buildPublicR2ObjectKey } from ${JSON.stringify(path.join(API, 'src/services/property-media/storage/r2-public-storage-provider.ts'))};

const propertyId = 'clpropertyid000000000001';
const key = buildPublicR2ObjectKey(propertyId, 'image/jpeg');
if (!key.startsWith('properties/' + propertyId + '/')) throw new Error('layout ' + key);
if (!isPublicR2MediaKey(key)) throw new Error('r2 key regex');
if (isLocalDevMediaKey(key)) throw new Error('r2 key must not look local');
if (isPublicR2MediaKey(propertyId + '/' + randomUUID() + '.jpg') === true && false) throw new Error('noop');
if (isPublicR2MediaKey('properties/' + propertyId + '/../secret.jpg')) throw new Error('traversal accepted');
if (isPublicR2MediaKey('properties/' + propertyId + '/file.exe')) throw new Error('exe accepted');

const legacyKey = propertyId + '/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
if (!isLocalDevMediaKey(legacyKey)) throw new Error('legacy local key');
if (isPublicR2MediaKey(legacyKey)) throw new Error('legacy classified as r2');

const publicUrl = buildPublicPropertyMediaUrl('https://cdn.example.test', key);
if (publicUrl !== 'https://cdn.example.test/' + key) throw new Error(publicUrl);

const resolved = resolvePropertyMediaPublicUrl({
  url: 'https://old.example.test/' + key,
  storageKey: key,
});
if (resolved !== 'https://cdn.example.test/' + key) throw new Error('resolve ' + resolved);

const legacyUrl = resolvePropertyMediaPublicUrl({
  url: 'https://images.unsplash.com/photo-legacy',
  storageKey: null,
});
if (legacyUrl !== 'https://images.unsplash.com/photo-legacy') throw new Error('legacy url');
if (!peekPublicMediaBaseUrl()) throw new Error('peek');
console.log('OK');
`,
  { CLOUDFLARE_R2_MEDIA_PUBLIC_URL: 'https://cdn.example.test' },
);
expectOk('object keys, public URL generation, and legacy URL compatibility', keysAndUrls);

const magic = runFile(
  `
import { assertPropertyImageUpload, detectPropertyImageMime } from ${JSON.stringify(path.join(API, 'src/lib/property-media-file-magic.ts'))};
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc000000301010018dd8db40000000049454e44ae426082', 'hex');
if (detectPropertyImageMime(png) !== 'image/png') throw new Error('png');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
if (detectPropertyImageMime(jpeg) !== 'image/jpeg') throw new Error('jpeg');
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
if (detectPropertyImageMime(svg) !== null) throw new Error('svg');
const html = Buffer.from('<html><body>x</body></html>');
if (detectPropertyImageMime(html) !== null) throw new Error('html');
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
if (detectPropertyImageMime(zip) !== null) throw new Error('zip');
const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
if (detectPropertyImageMime(exe) !== null) throw new Error('exe');

assertPropertyImageUpload({
  buffer: png,
  declaredMime: 'image/png',
  originalName: 'farm.png',
  maxBytes: 1024,
  allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
});

let oversized = false;
try {
  assertPropertyImageUpload({
    buffer: png,
    declaredMime: 'image/png',
    originalName: 'farm.png',
    maxBytes: 4,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  });
} catch (e: any) {
  oversized = e?.code === 'FILE_TOO_LARGE';
}
if (!oversized) throw new Error('oversized');

let rejected = false;
try {
  assertPropertyImageUpload({
    buffer: svg,
    declaredMime: 'image/svg+xml',
    originalName: 'x.svg',
    maxBytes: 1024,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  });
} catch (e: any) {
  rejected = e?.code === 'FILE_TYPE_REJECTED';
}
if (!rejected) throw new Error('svg not rejected');

let mismatch = false;
try {
  assertPropertyImageUpload({
    buffer: png,
    declaredMime: 'image/jpeg',
    originalName: 'farm.jpg',
    maxBytes: 1024,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  });
} catch (e: any) {
  mismatch = e?.code === 'MIME_MISMATCH';
}
if (!mismatch) throw new Error('mime mismatch');
console.log('OK');
`,
);
expectOk('magic-byte validation rejects SVG/HTML/exec/zip and oversized files', magic);

const mockedPut = runFile(
  `
import { CloudflareR2PublicStorageProvider } from ${JSON.stringify(path.join(API, 'src/services/property-media/storage/r2-public-storage-provider.ts'))};

async function main() {
  const calls: any[] = [];
  const fakeClient = {
    send: async (cmd: any) => {
      const input = cmd.input ?? cmd;
      calls.push(input);
      return {};
    },
  };
  const provider = new CloudflareR2PublicStorageProvider(
    {
      endpoint: 'https://acct123.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'public-media-bucket',
      publicBaseUrl: 'https://cdn.example.test',
      accessKeyId: 'r2access',
      secretAccessKey: 'r2secret',
      forcePathStyle: true,
      credentialSource: 'dedicated_media',
    },
    fakeClient,
  );
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc000000301010018dd8db40000000049454e44ae426082', 'hex');
  const uploaded = await provider.uploadImage(
    { buffer: png, mimetype: 'image/png', originalname: '../../evil.png' } as any,
    { propertyId: 'clpropertyid000000000001', uploadedByUserId: 'user1' },
  );
  if (!uploaded.storageKey.startsWith('properties/clpropertyid000000000001/')) throw new Error('key');
  if (uploaded.storageKey.includes('..') || uploaded.storageKey.includes('evil')) throw new Error('unsafe name');
  if (uploaded.url !== 'https://cdn.example.test/' + uploaded.storageKey) throw new Error('url');
  if (calls[0]?.Bucket !== 'public-media-bucket') throw new Error('wrong bucket');
  if (calls[0]?.Key !== uploaded.storageKey) throw new Error('put key');
  if (calls[0]?.ContentType !== 'image/png') throw new Error('content-type');
  if (calls[0]?.ACL) throw new Error('must not set ACL');

  await provider.deleteImage(uploaded.storageKey);
  if (calls[1]?.Bucket !== 'public-media-bucket') throw new Error('delete bucket');
  if (calls[1]?.Key !== uploaded.storageKey) throw new Error('delete key');

  let traversal = false;
  try {
    await provider.deleteImage('properties/clpropertyid000000000001/../secret.jpg');
  } catch {
    traversal = true;
  }
  if (!traversal) throw new Error('traversal delete');
  console.log('OK');
}
main();
`,
);
expectOk('mocked R2 put/delete uses public media bucket and safe generated keys', mockedPut);

const denied = runFile(
  `
import { CloudflareR2PublicStorageProvider } from ${JSON.stringify(path.join(API, 'src/services/property-media/storage/r2-public-storage-provider.ts'))};
async function main() {
  const fakeClient = {
    send: async () => {
      const err: any = new Error('Access Denied');
      err.name = 'AccessDenied';
      err.Code = 'AccessDenied';
      err.$metadata = { httpStatusCode: 403 };
      throw err;
    },
  };
  const provider = new CloudflareR2PublicStorageProvider(
    {
      endpoint: 'https://acct123.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'public-media-bucket',
      publicBaseUrl: 'https://cdn.example.test',
      accessKeyId: 'r2access',
      secretAccessKey: 'r2secret',
      forcePathStyle: true,
      credentialSource: 'dedicated_media',
    },
    fakeClient,
  );
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc000000301010018dd8db40000000049454e44ae426082', 'hex');
  try {
    await provider.uploadImage(
      { buffer: png, mimetype: 'image/png', originalname: 'farm.png' } as any,
      { propertyId: 'clpropertyid000000000001', uploadedByUserId: 'user1' },
    );
    throw new Error('should have failed');
  } catch (e: any) {
    if (e?.code !== 'PROPERTY_MEDIA_STORAGE_DENIED') throw new Error(String(e?.code ?? e?.message));
    const dumped = String(e?.message ?? '') + JSON.stringify(e);
    if (/secret|Authorization|AWS4-HMAC|r2secret/i.test(dumped)) throw new Error('secret leaked');
  }
  console.log('OK');
}
main();
`,
);
expectOk('R2 AccessDenied maps to safe PROPERTY_MEDIA_STORAGE_DENIED', denied);

async function liveApi() {
  console.log('\n  — live API —\n');
  try {
    const health = await fetch(`${BASE.replace(/\/api\/v1$/, '')}/api/v1/health`);
    if (!health.ok) throw new Error('health');
  } catch (e) {
    fail('API reachable', e instanceof Error ? e.message : String(e));
    return;
  }

  cookieJar = '';
  const guest = await api('POST', '/owner/properties/any-id/media', pngForm(), false);
  if (guest.status === 401) pass('guest file upload → 401');
  else fail('guest file upload → 401', `got ${guest.status}`);

  await login(CUSTOMER);
  const cust = await api('POST', '/owner/properties/any-id/media', pngForm());
  if (cust.status === 403) pass('customer file upload → 403');
  else fail('customer file upload → 403', `got ${cust.status}`);

  await login(OWNER1);
  const created = await api('POST', '/owner/properties', {
    type: 'farm',
    titleAr: `اختبار وسائط عامة ${Date.now()}`,
    titleEn: 'QA Public Media Foundation',
    descriptionAr: 'وصف تجريبي لتحميل صور المزرعة العامة والتحقق من الصلاحيات والترتيب.',
    descriptionEn: 'Draft property for public media upload, auth, ordering, and deletion QA.',
    city: 'amman',
    area: 'qa-public-media',
    approximateAddress: 'منطقة اختبار',
    exactAddress: 'عنوان داخلي للاختبار',
    basePrice: 110,
    capacity: 8,
    imageUrls: [],
    amenityKeys: [],
    rules: [],
  });
  const propId = created.json.data?.id;
  if (!propId) {
    fail('create draft for media QA', `status ${created.status}`);
    return;
  }
  pass('create draft property for media QA');

  const valid = await api('POST', `/owner/properties/${propId}/media`, pngForm());
  const first = valid.json.data?.media?.[0];
  if (valid.status === 201 && first?.url && first?.isCover === true && first?.sortOrder === 0) {
    pass('valid image upload');
  } else {
    fail('valid image upload', `status ${valid.status} code ${valid.json.code}`);
  }

  const svgFd = new FormData();
  svgFd.append(
    'file',
    new Blob([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')], { type: 'image/svg+xml' }),
    'x.svg',
  );
  const invalid = await api('POST', `/owner/properties/${propId}/media`, svgFd);
  if (invalid.status === 400 && invalid.json.code === 'FILE_TYPE_REJECTED') {
    pass('invalid file rejected');
  } else {
    fail('invalid file rejected', `status ${invalid.status} code ${invalid.json.code}`);
  }

  const exeFd = new FormData();
  exeFd.append(
    'file',
    new Blob([Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00])], {
      type: 'application/octet-stream',
    }),
    'payload.exe',
  );
  const exe = await api('POST', `/owner/properties/${propId}/media`, exeFd);
  if (exe.status === 400 && exe.json.code === 'FILE_TYPE_REJECTED') {
    pass('executable upload rejected');
  } else {
    fail('executable upload rejected', `status ${exe.status} code ${exe.json.code}`);
  }

  const oversized = new Uint8Array(9 * 1024 * 1024);
  oversized[0] = 0xff;
  oversized[1] = 0xd8;
  oversized[2] = 0xff;
  const bigFd = new FormData();
  bigFd.append('file', new Blob([oversized], { type: 'image/jpeg' }), 'huge.jpg');
  const big = await api('POST', `/owner/properties/${propId}/media`, bigFd);
  if (
    (big.status === 413 && big.json.code === 'PAYLOAD_TOO_LARGE') ||
    (big.status === 400 && big.json.code === 'FILE_TOO_LARGE')
  ) {
    pass('oversized file rejected');
  } else {
    fail('oversized file rejected', `status ${big.status} code ${big.json.code}`);
  }

  const second = await api('POST', `/owner/properties/${propId}/media`, pngForm('farm-2.png'));
  const mediaAfterTwo = second.json.data?.media ?? [];
  if (second.status === 201 && mediaAfterTwo.length === 2) {
    pass('second image preserves first cover');
  } else {
    fail('second image', `status ${second.status} count ${mediaAfterTwo.length}`);
  }

  const ids = mediaAfterTwo.map((m) => m.id);
  const reordered = await api('PATCH', `/owner/properties/${propId}/media/reorder`, {
    mediaIds: [...ids].reverse(),
  });
  const afterReorder = reordered.json.data?.media ?? [];
  if (
    reordered.status === 200 &&
    afterReorder[0]?.id === ids[1] &&
    afterReorder[0]?.isCover === true &&
    afterReorder[0]?.sortOrder === 0 &&
    afterReorder[1]?.id === ids[0]
  ) {
    pass('image ordering');
  } else {
    fail('image ordering', `status ${reordered.status}`);
  }

  const coverId = afterReorder[1]?.id;
  const cover = await api('POST', `/owner/properties/${propId}/media/${coverId}/set-cover`);
  if (cover.status === 200 && cover.json.data?.media?.[0]?.id === coverId && cover.json.data?.media?.[0]?.isCover) {
    pass('cover image');
  } else {
    fail('cover image', `status ${cover.status}`);
  }

  const toDelete = cover.json.data?.media?.[1]?.id;
  const del = await api('DELETE', `/owner/properties/${propId}/media/${toDelete}`);
  if (del.status === 200 && (del.json.data?.media ?? []).length === 1) {
    pass('deletion');
  } else {
    fail('deletion', `status ${del.status}`);
  }

  const leftover = del.json.data?.media?.[0];
  if (leftover?.storageKey && leftover.url) {
    const looksR2 = String(leftover.storageKey).startsWith('properties/');
    const looksLocal = !looksR2 && leftover.url.includes('/uploads/property-media/');
    if (looksR2 || looksLocal) pass('new upload stores durable object key + usable URL');
    else fail('durable object key', `key=${leftover.storageKey}`);
  }

  const legacy = await api('POST', `/owner/properties/${propId}/media`, { url: SAMPLE_URL });
  const legacyRow = (legacy.json.data?.media ?? []).find((m) => m.url === SAMPLE_URL);
  if (legacy.status === 201 && legacyRow && !legacyRow.storageKey) {
    pass('legacy image compatibility (URL import still works)');
  } else {
    fail('legacy URL import', `status ${legacy.status}`);
  }

  await login(OWNER2);
  const cross = await api('POST', `/owner/properties/${propId}/media`, pngForm());
  if (cross.status === 403 && (cross.json.code === 'PROPERTY_MEDIA_NOT_OWNED' || cross.json.code === 'FORBIDDEN')) {
    pass('cross-owner denial');
  } else {
    fail('cross-owner denial', `status ${cross.status} code ${cross.json.code}`);
  }

  await login(OWNER1);
  const own = await api('POST', `/owner/properties/${propId}/media`, pngForm('own.png'));
  if (own.status === 201) pass('owner authorization');
  else fail('owner authorization', `status ${own.status}`);

  cookieJar = '';
  const list = await api('GET', '/properties', null, false);
  const published = list.json.data?.find((p) => p.imageUrl);
  if (published?.imageUrl && published.slug) {
    const detail = await api('GET', `/properties/${published.slug}`, null, false);
    if (detail.status === 200 && Array.isArray(detail.json.data?.images) && detail.json.data.images[0]?.url) {
      pass('public users can read published property images');
    } else {
      fail('public property images', `status ${detail.status}`);
    }
  } else {
    fail('find published property with imageUrl', 'none');
  }

  await login(ADMIN);
  const adminProps = await api('GET', '/admin/properties');
  const adminPropId = adminProps.json.data?.[0]?.id;
  if (!adminPropId) {
    fail('admin property list', 'empty');
  } else {
    const adminDetail = await api('GET', `/admin/properties/${adminPropId}`);
    if (adminDetail.status === 200 && Array.isArray(adminDetail.json.data?.media)) {
      pass('admin property views include media');
    } else {
      fail('admin property media', `status ${adminDetail.status}`);
    }
  }
}

await liveApi();

console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
