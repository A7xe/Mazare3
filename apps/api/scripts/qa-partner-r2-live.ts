/**
 * Live Cloudflare R2 verification: one isolated QA object via the API path.
 * Does not print credentials, account IDs, endpoints, or storage keys.
 */
import { createApp } from '../src/app.js';
import {
  loadPartnerDocumentStorageConfig,
  validatePartnerDocumentStorageAtStartup,
} from '../src/config/partner-document-storage.config.js';
import { getPartnerDocumentStorage } from '../src/services/partner-documents/private-storage.js';
import { prisma } from '@mazare3/db';

const PORT = Number(process.env.QA_R2_PORT ?? 4013);
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const RUN = `r2live-${Date.now()}`;
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);

let cookie = '';
let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: unknown) {
  failed++;
  console.log(`  ❌ ${name}: ${sanitize(String(detail))}`);
}
function sanitize(text: string) {
  return text
    .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/[A-Za-z0-9+/_-]{24,}={0,2}/g, '[redacted]')
    .slice(0, 240);
}

async function api(method: string, path: string, body?: unknown, useCookie = true) {
  const headers: Record<string, string> = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (useCookie && cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]!).join('; ');
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 80) };
  }
  return { status: res.status, json, headers: res.headers };
}

async function login(creds: { email: string; password: string }) {
  cookie = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

function leak(json: unknown) {
  const dumped = JSON.stringify(json);
  return (
    dumped.includes('storageKey') ||
    dumped.includes('cloudflarestorage.com') ||
    dumped.includes('r2.dev') ||
    dumped.includes('CLOUDFLARE_R2') ||
    dumped.includes('secretAccessKey')
  );
}

process.env.DISABLE_AUTH_RATE_LIMIT = 'true';

validatePartnerDocumentStorageAtStartup();
const cfg = loadPartnerDocumentStorageConfig();
if (cfg.provider !== 'cloudflare_r2_private' || !cfg.s3) {
  console.error('BLOCKED: PARTNER_DOCUMENT_STORAGE_PROVIDER is not cloudflare_r2_private');
  process.exit(2);
}
console.log(`\n🔐 Live R2 verification (bucket=${cfg.s3.bucket}, provider=${cfg.provider})\n`);

const app = createApp();
const server = await new Promise<import('http').Server>((resolve) => {
  const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
});

let storageKey: string | null = null;
let documentId: string | null = null;

try {
  cookie = '';
  const email = `${RUN}@test.mazare3.jo`;
  const signup = await api(
    'POST',
    '/auth/signup',
    { email, password: 'Mazare3Demo2026!', name: 'R2 Live', locale: 'ar' },
    false,
  );
  if (signup.status !== 201) throw new Error(`signup ${signup.status}`);

  const profile = await api('PATCH', '/owner/onboarding/profile', {
    entityType: 'individual',
    displayName: 'تحقق تخزين',
    phone: '0791234501',
    city: 'amman',
    area: 'dabouq',
    bio: 'نبذة تشغيلية كافية لرفع وثيقة تحقق معزولة على التخزين الخاص.',
    legalName: 'تحقق تخزين',
    operatingPhone: '0791234501',
    operatingCity: 'amman',
    operatingArea: 'dabouq',
  });
  if (profile.status !== 200) throw new Error(`profile ${profile.status}`);
  const profileData = profile.json.data as { ownerProfileId?: string } | undefined;

  const reqs = await api('GET', '/owner/onboarding/requirements');
  const requirement = ((reqs.json.data as { required?: boolean; id: string }[]) ?? []).find((r) => r.required);
  if (!requirement) throw new Error('no required document type');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), `r2-qa-${RUN}.png`);
  form.append('requirementId', requirement.id);
  const up = await api('POST', '/owner/onboarding/documents', form);
  const upData = up.json.data as { id?: string } | undefined;
  if (up.status === 201 && upData?.id && !leak(up.json)) {
    pass('upload to configured private R2 bucket via API');
    pass('client JSON has no storage key / public R2 URL');
    documentId = upData.id;
  } else {
    fail('upload', `status ${up.status} ${JSON.stringify(up.json).slice(0, 160)}`);
    throw new Error('upload failed');
  }

  const ownerCookie = cookie;
  const ownerFile = await api('GET', `/owner/onboarding/documents/${documentId}/file`);
  if (ownerFile.status === 200 && ownerFile.headers.get('content-type')?.includes('image/png')) {
    pass('authenticated owner streams document through backend');
  } else fail('owner read', `status ${ownerFile.status}`);

  const unauth = await api('GET', `/owner/onboarding/documents/${documentId}/file`, undefined, false);
  if (unauth.status === 401) pass('unauthenticated read is 401');
  else fail('unauth', `status ${unauth.status}`);

  cookie = '';
  await api(
    'POST',
    '/auth/signup',
    { email: `other-${RUN}@test.mazare3.jo`, password: 'Mazare3Demo2026!', name: 'Other', locale: 'ar' },
    false,
  );
  const other = await api('GET', `/owner/onboarding/documents/${documentId}/file`);
  if (other.status === 401 || other.status === 403 || other.status === 404) {
    pass('another owner cannot read the document');
  } else fail('other owner', `status ${other.status}`);

  const ownerProfileId = profileData?.ownerProfileId;
  await login(ADMIN);
  if (ownerProfileId && documentId) {
    const adminFile = await api('GET', `/admin/partners/${ownerProfileId}/documents/${documentId}/file`);
    if (adminFile.status === 200) pass('authorized admin stream succeeds');
    else fail('admin read', `status ${adminFile.status}`);
  }

  const row = await prisma.ownerDocument.findUnique({
    where: { id: documentId },
    select: { storageKey: true },
  });
  storageKey = row?.storageKey ?? null;
  if (!storageKey) throw new Error('missing internal storage key');

  const liveGet = await getPartnerDocumentStorage().get(storageKey);
  if (liveGet.length > 0) pass('R2 object exists after upload (server-side get)');
  else fail('r2 get after upload', 'empty body');

  cookie = ownerCookie;
  const del = await api('DELETE', `/owner/onboarding/documents/${documentId}`);
  if (del.status === 200) pass('delete through application API');
  else fail('delete api', `status ${del.status}`);

  let gone = false;
  try {
    await getPartnerDocumentStorage().get(storageKey);
  } catch {
    gone = true;
  }
  if (gone) pass('R2 object is gone after delete');
  else fail('r2 still present', 'get succeeded after delete');

  const afterDel = await prisma.ownerDocument.findUnique({ where: { id: documentId } });
  if (!afterDel) pass('database document record removed');
  else fail('db row', 'document still present');
} catch (e) {
  fail('live verification aborted', e instanceof Error ? e.message : e);
  if (storageKey) {
    await getPartnerDocumentStorage()
      .delete(storageKey)
      .catch(() => undefined);
    console.log('  ℹ️  attempted cleanup of isolated QA object');
  }
} finally {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await prisma.$disconnect();
}

console.log(`\nLive R2: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
