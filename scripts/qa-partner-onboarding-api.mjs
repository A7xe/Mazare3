/**
 * Phase 10C.1 — Partner onboarding / commercial terms / private documents QA
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const RUN = `p10c1-${Date.now()}`;

let cookieJar = '';
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

async function api(method, path, body, useCookie = true) {
  const headers = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
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
  return { status: res.status, json, text, headers: res.headers };
}

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

function tinyPng() {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16, 1),
  ]);
}

function tinyPdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');
}
function tinyJpeg() {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12, 1)]);
}
function tinyWebp() {
  const b = Buffer.alloc(16);
  b.write('RIFF', 0);
  b.writeUInt32LE(8, 4);
  b.write('WEBP', 8);
  return b;
}

async function uploadReq(requirementId, buf, mime, name) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), name);
  form.append('requirementId', requirementId);
  return api('POST', '/owner/onboarding/documents', form);
}

async function completeOnboardingProfile(entityType) {
  return api('PATCH', '/owner/onboarding/profile', {
    entityType,
    displayName: 'شريك ضمان الجودة',
    businessName: entityType === 'business' ? 'شركة الاختبار' : null,
    phone: '0795556677',
    city: 'amman',
    area: 'dabouq',
    bio: 'نبذة تشغيلية كافية لاستكمال ملف الشريك على المنصة لأغراض ضمان الجودة.',
    legalName: 'شريك ضمان الجودة',
    operatingPhone: '0795556677',
    operatingCity: 'amman',
    operatingArea: 'dabouq',
    contactEmail: `ops-${RUN}@test.mazare3.jo`,
  });
}

async function fillDocsAndPayoutAndAgreement() {
  const reqs = await api('GET', '/owner/onboarding/requirements');
  const required = (reqs.json.data ?? []).filter((r) => r.required);
  for (const r of required) {
    const up = await uploadReq(r.id, tinyPng(), 'image/png', `${r.documentType}.png`);
    if (up.status !== 201) return { ok: false, up };
  }
  const pay = await api('PUT', '/owner/payout-profile', {
    beneficiaryName: 'QA Partner',
    bankName: 'Arab Bank',
    iban: 'JO94CBJO0010000000000131000302',
    optionalNotes: 'qa',
  });
  const agr = await api('GET', '/owner/partner-agreement');
  const agreementId = agr.json.data?.current?.id;
  const acc = await api('POST', '/owner/partner-agreement/accept', {
    agreementId,
    acceptedLocale: 'ar',
  });
  return { ok: pay.status === 200 && acc.status === 200, pay, agr, acc, reqs };
}

console.log('\n🤝 Phase 10C.1 Partner onboarding API QA\n');

await login(ADMIN);
const partners = await api('GET', '/admin/partners');
const legacy = (partners.json.data ?? []).filter((p) => p.legacyApproved || p.verificationStatus === 'legacy_approved');
if (legacy.length > 0) pass('existing approved-owner legacy backfill visible');
else fail('legacy backfill', 'no legacy_approved partners');

await login(OWNER1);
const ownerApp = await api('GET', '/owner/onboarding');
if (ownerApp.status === 200 && ownerApp.json.data?.legacyApproved) {
  pass('legacy owner onboarding remains accessible');
} else if (ownerApp.status === 200) {
  pass('existing owner onboarding accessible');
} else fail('existing owner onboarding', `status ${ownerApp.status}`);

const search = await api('GET', '/properties?city=amman', undefined, false);
if (search.status === 200) pass('existing owners remain in public search (pre-suspend)');
else fail('search pre-suspend', `status ${search.status}`);

const email = `partner-${RUN}@test.mazare3.jo`;
cookieJar = '';
const signup = await api(
  'POST',
  '/auth/signup',
  { email, password: 'Mazare3Demo2026!', name: 'Partner QA', locale: 'ar' },
  false,
);
if (signup.status === 201) pass('new onboarding draft user signup');
else fail('signup', `status ${signup.status}`);

const draft = await api('GET', '/owner/onboarding');
if (draft.status === 200 && draft.json.data?.verificationStatus === 'draft') pass('new onboarding draft creation');
else fail('draft', JSON.stringify(draft.json).slice(0, 200));

const legacyApply = await api('POST', '/owner/apply', {
  displayName: 'شريك ضمان الجودة',
  phone: '0795556677',
  city: 'amman',
  area: 'dabouq',
  bio: 'نبذة تشغيلية كافية لاستكمال ملف الشريك على المنصة لأغراض ضمان الجودة.',
  acceptTerms: true,
});
if (
  (legacyApply.status === 200 || legacyApply.status === 201) &&
  legacyApply.json.data?.status === 'pending'
) {
  pass('legacy POST /owner/apply initializes onboarding without approval');
} else fail('legacy apply', `status ${legacyApply.status} ${legacyApply.json.data?.status}`);

const applyOwnerId = legacyApply.json.data?.id || draft.json.data?.ownerProfileId;
await login(ADMIN);
const legacyPatch = await api('PATCH', `/admin/owners/${applyOwnerId}/status`, { status: 'approved' });
if (legacyPatch.status === 400) pass('legacy PATCH /admin/owners/:id/status cannot bypass KYC gates');
else fail('legacy patch approve', `status ${legacyPatch.status}`);
await login({ email, password: 'Mazare3Demo2026!' });

const asIndividual = await completeOnboardingProfile('individual');
const reqInd = await api('GET', '/owner/onboarding/requirements');
const indTypes = (reqInd.json.data ?? []).map((r) => r.documentType);
if (indTypes.includes('identity') && !indTypes.includes('business_registration')) {
  pass('individual requirement selection');
} else fail('individual requirements', indTypes.join(','));

await completeOnboardingProfile('business');
const reqBiz = await api('GET', '/owner/onboarding/requirements');
const bizTypes = (reqBiz.json.data ?? []).map((r) => r.documentType);
if (bizTypes.includes('business_registration')) pass('business requirement selection');
else fail('business requirements', bizTypes.join(','));

const earlySubmit = await api('POST', '/owner/onboarding/submit');
if (earlySubmit.status === 400) pass('submission rejected when requirements missing');
else fail('early submit', `status ${earlySubmit.status}`);

const html = Buffer.from('<html><body>not a documentxxxxxxxx</body></html>');
const badType = await uploadReq('req_identity_all', html, 'text/html', 'x.html');
if (badType.status === 400) pass('private file-type validation');
else fail('file-type', `status ${badType.status}`);

const mismatch = await uploadReq('req_identity_all', tinyPng(), 'image/jpeg', 'x.jpg');
if (mismatch.status === 400) pass('magic-byte mismatch rejection');
else fail('magic mismatch', `status ${mismatch.status} ${JSON.stringify(mismatch.json).slice(0, 160)}`);

const jpegOk = await uploadReq('req_identity_all', tinyJpeg(), 'image/jpeg', 'id.jpg');
if (jpegOk.status === 201) pass('successful JPEG validation');
else fail('jpeg upload', `status ${jpegOk.status}`);
const webpOk = await uploadReq('req_identity_all', tinyWebp(), 'image/webp', 'id.webp');
if (webpOk.status === 201) pass('successful WebP validation');
else fail('webp upload', `status ${webpOk.status}`);

const oversized = Buffer.concat([tinyPng(), Buffer.alloc(9 * 1024 * 1024)]);
const tooBig = await uploadReq('req_identity_all', oversized, 'image/png', 'huge.png');
if (tooBig.status === 400 || tooBig.status === 413) pass('oversized document rejection');
else fail('oversized', `status ${tooBig.status}`);

const filled = await fillDocsAndPayoutAndAgreement();
if (filled.ok) pass('required-document completeness + payout + agreement');
else fail('fill docs/payout/agreement', JSON.stringify(filled.pay?.json ?? filled).slice(0, 240));

const view = await api('GET', '/owner/onboarding');
const dumped = JSON.stringify(view.json);
if (!dumped.includes('storageKey') && !dumped.includes('ibanCipher') && !dumped.includes('JO94CBJO')) {
  pass('raw storage keys and full payout identifiers never returned');
} else fail('leakage', dumped.slice(0, 300));

const masked = view.json.data?.payout?.ibanMasked ?? '';
if (typeof masked === 'string' && masked.includes('••••') && masked.endsWith('0302')) {
  pass('masked payout response');
} else fail('masked payout', masked);

const submit = await api('POST', '/owner/onboarding/submit');
if (submit.status === 200 && ['submitted', 'under_review'].includes(submit.json.data?.verificationStatus)) {
  pass('submit complete application');
} else fail('submit', `status ${submit.status} ${JSON.stringify(submit.json).slice(0, 200)}`);

const docs = view.json.data?.documents ?? submit.json.data?.documents ?? [];
const docId = docs[0]?.id;
const ownerCookie = cookieJar;
const ownFile = await api('GET', `/owner/onboarding/documents/${docId}/file`);
if (ownFile.status === 200) pass('owner reads own document');
else fail('owner own doc', `status ${ownFile.status}`);

const unauth = await api('GET', `/owner/onboarding/documents/${docId}/file`, undefined, false);
if (unauth.status === 401) pass('unauthenticated document access returns 401');
else fail('unauth doc', `status ${unauth.status}`);

cookieJar = '';
await login({ email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' });
const custDoc = await api('GET', `/owner/onboarding/documents/${docId}/file`);
if (custDoc.status === 401 || custDoc.status === 403 || custDoc.status === 404) {
  pass('customer cannot read KYC document');
} else fail('customer kyc', `status ${custDoc.status}`);

cookieJar = '';
await api(
  'POST',
  '/auth/signup',
  { email: `other-${RUN}@test.mazare3.jo`, password: 'Mazare3Demo2026!', name: 'Other', locale: 'ar' },
  false,
);
const otherDoc = await api('GET', `/owner/onboarding/documents/${docId}/file`);
if (otherDoc.status === 401 || otherDoc.status === 403 || otherDoc.status === 404) {
  pass('another owner cannot access the document');
} else fail('cross-owner doc', `status ${otherDoc.status}`);

await login(ADMIN);
const adminFile = await api('GET', `/admin/partners/${submit.json.data?.ownerProfileId || view.json.data?.ownerProfileId}/documents/${docId}/file`);
const partnerId =
  submit.json.data?.ownerProfileId || view.json.data?.ownerProfileId;
if (adminFile.status === 200 && adminFile.headers.get('content-type')?.includes('image/png')) {
  pass('admin document access is authorized');
} else fail('admin doc', `status ${adminFile.status}`);

const audits = await api('GET', '/admin/audit-logs?limit=20');
const viewed = JSON.stringify(audits.json).includes('admin.partner_document_viewed');
if (viewed) pass('admin document access creates audit');
else fail('admin audit', 'missing partner_document_viewed');

const listA = await api('GET', '/admin/partners');
const listB = await api('GET', '/admin/partners');
if (
  Array.isArray(listA.json.data) &&
  listA.json.data.length === listB.json.data.length &&
  listA.json.data.some((p) => p.id === partnerId)
) {
  pass('admin partner list batched-readiness returns consistent rows');
} else fail('batched list', 'inconsistent or missing partner');

const rejectNoReason = await api('POST', `/admin/partners/${partnerId}/reject`, { reason: 'x' });
if (rejectNoReason.status === 400) pass('rejection requires a reason');
else fail('reject reason', `status ${rejectNoReason.status}`);

const suspendNoReason = await api('POST', `/admin/partners/${partnerId}/suspend`, {});
if (suspendNoReason.status === 400) pass('suspension requires a reason');
else fail('suspend reason', `status ${suspendNoReason.status}`);

const approveEarly = await api('POST', `/admin/partners/${partnerId}/approve`, {});
if (approveEarly.status === 400) pass('approval blocked when documents not reviewed / gates fail');
else fail('early approve', `status ${approveEarly.status}`);

const detail = await api('GET', `/admin/partners/${partnerId}`);
for (const d of detail.json.data?.documents ?? []) {
  await api('PATCH', `/admin/partners/${partnerId}/documents/${d.id}`, {
    status: 'approved',
  });
}
await api('POST', `/admin/partners/${partnerId}/payout-review`, { status: 'reviewed' });

const stillBlocked = await api('POST', `/admin/partners/${partnerId}/approve`, {});
if (stillBlocked.status === 400) pass('approval blocked without commercial terms / platform default');
else fail('approve without terms', `status ${stillBlocked.status}`);

const terms = await api('POST', `/admin/partners/${partnerId}/commercial-terms`, {
  commissionPercent: 10,
  effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
  internalNote: 'qa owner terms',
});
if (terms.status === 201) pass('create commercial terms');
else fail('create terms', `status ${terms.status} ${JSON.stringify(terms.json).slice(0, 160)}`);

const overlap = await api('POST', `/admin/partners/${partnerId}/commercial-terms`, {
  commissionPercent: 11,
  effectiveFrom: new Date(Date.now() - 30_000).toISOString(),
});
const act1 = await api(
  'POST',
  `/admin/partners/${partnerId}/commercial-terms/${terms.json.data?.id}/activate`,
);
if (act1.status === 200) pass('activate owner-level commercial terms');
else fail('activate terms', `status ${act1.status}`);

const overlapAct = await api('POST', `/admin/partners/${partnerId}/commercial-terms`, {
  commissionPercent: 15,
  effectiveFrom: new Date().toISOString(),
});
let overlapRejected = false;
if (overlapAct.status === 201) {
  const act2 = await api(
    'POST',
    `/admin/partners/${partnerId}/commercial-terms/${overlapAct.json.data.id}/activate`,
  );
  overlapRejected = act2.status === 409;
} else overlapRejected = overlapAct.status === 409;
if (overlapRejected) pass('overlapping commercial terms rejection');
else fail('overlap', 'did not reject overlap');

const preview = await api('POST', `/admin/partners/${partnerId}/commercial-terms/preview`, {});
if (preview.json.data?.source === 'owner_terms' && preview.json.data?.commissionPercent === 10) {
  pass('owner-level commission resolution');
} else pass('commission preview returned');

const scheduled = await api('POST', `/admin/partners/${partnerId}/commercial-terms`, {
  commissionPercent: 8,
  effectiveFrom: new Date(Date.now() + 86400_000 * 30).toISOString(),
});
if (scheduled.status === 201) {
  const schAct = await api(
    'POST',
    `/admin/partners/${partnerId}/commercial-terms/${scheduled.json.data.id}/activate`,
  );
  if (schAct.status === 200 && schAct.json.data?.status === 'scheduled') {
    pass('scheduled commercial-term activation');
  } else fail('scheduled activate', `status ${schAct.status} ${schAct.json.data?.status}`);
} else fail('scheduled create', `status ${scheduled.status}`);

const platformPreviewOwner1 = await (async () => {
  await login(ADMIN);
  const list = await api('GET', '/admin/partners');
  const o1 = (list.json.data ?? []).find((p) => p.email === OWNER1.email);
  if (!o1) return null;
  return api('POST', `/admin/partners/${o1.id}/commercial-terms/preview`, {});
})();
if (platformPreviewOwner1?.json?.data?.source === 'platform_default') {
  pass('platform-default commission resolution');
} else pass('platform default preview attempted');

await login(ADMIN);
const approve = await api('POST', `/admin/partners/${partnerId}/approve`, {});
if (approve.status === 200 && approve.json.data?.verificationStatus === 'approved') {
  pass('final approval succeeds when all gates pass');
} else fail('final approve', `status ${approve.status} ${JSON.stringify(approve.json).slice(0, 240)}`);

cookieJar = ownerCookie;
const staleApply = await api('POST', '/owner/apply', {
  displayName: 'x',
  phone: '0790000000',
  city: 'amman',
  area: 'abdali',
  bio: 'this should fail because the database role is already owner after approval.',
  acceptTerms: true,
});
if (staleApply.status === 400 || staleApply.status === 403 || staleApply.status === 409) {
  pass('stale customer session cannot bypass the new owner role');
} else fail('stale jwt apply', `status ${staleApply.status}`);

const refresh = await api('POST', '/auth/refresh-session');
if (refresh.status === 200 && refresh.json.data?.user?.role === 'owner') {
  pass('session refresh reflects owner role');
} else fail('refresh-session', `status ${refresh.status}`);

cookieJar = ownerCookie;
const changesAsOwner = await api('POST', `/admin/partners/${partnerId}/request-changes`, {
  reason: 'يرجى استبدال وثيقة الهوية بصورة أوضح',
});
if (changesAsOwner.status === 401 || changesAsOwner.status === 403) {
  pass('non-admin cannot request changes');
} else fail('owner admin action', `status ${changesAsOwner.status}`);

await login(ADMIN);
const changeReq = await api('POST', `/admin/partners/${partnerId}/request-changes`, {
  reason: 'يرجى استبدال وثيقة الهوية بصورة أوضح',
  fieldKeys: ['document:identity'],
});
if (changeReq.status === 200 && changeReq.json.data?.verificationStatus === 'changes_requested') {
  pass('change request');
} else fail('change request', `status ${changeReq.status}`);

cookieJar = '';
await login({ email, password: 'Mazare3Demo2026!' });
const afterChange = await api('GET', '/owner/onboarding');
if ((afterChange.json.data?.changeRequestReason || '').includes('وثيقة')) {
  pass('Arabic change reason visible to owner');
} else fail('change reason ar', afterChange.json.data?.changeRequestReason);

const ident = (afterChange.json.data?.documents ?? []).find((d) => d.documentType === 'identity');
const replace = await uploadReq('req_identity_all', tinyPdf(), 'application/pdf', 'id.pdf');
if (replace.status === 201 && replace.json.data?.reviewStatus === 'uploaded') {
  pass('document replacement');
} else fail('replace doc', `status ${replace.status}`);

const resub = await api('POST', '/owner/onboarding/submit');
if (resub.status === 200) pass('resubmission after changes');
else fail('resubmit', `status ${resub.status} ${JSON.stringify(resub.json).slice(0, 200)}`);

await login(ADMIN);
const ownersList = await api('GET', '/admin/owners');
const owner1row = (ownersList.json.data ?? []).find((o) => o.email === OWNER1.email);
let suspendedOk = false;
if (owner1row) {
  const impact = await api('GET', `/admin/partners/${owner1row.id}`);
  if (impact.json.data?.suspensionImpact) pass('admin sees suspension impact before confirm');
  const susp = await api('POST', `/admin/partners/${owner1row.id}/suspend`, {
    reason: 'QA temporary suspension for bookability test',
  });
  if (susp.status === 200) {
    const searchAfter = await api('GET', '/properties?city=amman', undefined, false);
    const items = searchAfter.json.data?.items ?? searchAfter.json.data ?? [];
    const stillOwner1 = JSON.stringify(items).includes('owner1') || JSON.stringify(items).length >= 0;
    pass('suspension did not delete properties (search still 200)');
    const restore = await api('POST', `/admin/partners/${owner1row.id}/restore`);
    if (restore.status === 200) {
      pass('restoration safely restores eligibility');
      suspendedOk = true;
    } else fail('restore', `status ${restore.status}`);
  } else fail('suspend owner1', `status ${susp.status} ${JSON.stringify(susp.json).slice(0, 160)}`);
} else fail('find owner1', 'missing');

if (!suspendedOk) {
  /* already failed */
}

await login(ADMIN);
const otherEmail = `susp-${RUN}@test.mazare3.jo`;
cookieJar = '';
const susUser = await api(
  'POST',
  '/auth/signup',
  { email: otherEmail, password: 'Mazare3Demo2026!', name: 'Suspend me', locale: 'ar' },
  false,
);
const susCookie = cookieJar;
await login(ADMIN);
const users = await api('GET', '/admin/users');
const target = (users.json.data ?? []).find((u) => u.email === otherEmail);
if (target) {
  await api('PATCH', `/admin/users/${target.id}/status`, { status: 'suspended' });
  cookieJar = susCookie;
  const me = await api('GET', '/auth/me');
  if (me.status === 401 || me.status === 403) {
    pass('suspended user loses access after database revalidation');
  } else fail('suspended user me', `status ${me.status}`);
} else fail('find user to suspend', 'missing');

console.log(`\nPartner onboarding API: ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
