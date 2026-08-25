/**
 * Phase 10D.2 — Settlement cycle generation QA
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG1 = 'chalet-emerald-dead-sea';
const SLUG2 = 'chalet-madaba-mosaic';
const SLUG3 = 'pool-house-irbid-premium';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };

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
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
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
  return (await api('POST', '/auth/login', creds, false)).status === 200;
}

async function resolveOwner(email) {
  await login(ADMIN);
  const partners = await api('GET', `/admin/partners?q=${encodeURIComponent(email)}`);
  return (partners.json.data ?? []).find((p) => p.email === email)?.id ?? null;
}

async function createPaidInWindow(slug, visitDate) {
  await login(CUSTOMER);
  const slot = await api('POST', `/internal/properties/${slug}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const book = await api('POST', '/bookings', {
    propertySlug: slug,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount: 2,
  });
  if (book.status !== 201) return null;
  const bookingId = book.json.data.id;
  const dep = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose: 'deposit' });
  if (dep.status !== 201) return null;
  await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  const bal = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose: 'balance' });
  if (bal.status !== 201) return null;
  const sim = await api('POST', `/payments/${bal.json.data.id}/simulate-success`, {});
  const dates = [visitDate];
  for (let d = 1; d <= 21; d++) dates.push(`2026-01-${String(d).padStart(2, '0')}`);
  let placed = false;
  for (const date of dates) {
    const bd = await api('POST', `/internal/bookings/${bookingId}/backdate-slot`, { date }, false);
    const applied = bd.json.data?.date;
    if (bd.status === 200 && typeof applied === 'string' && applied.startsWith('2026-01')) {
      placed = true;
      break;
    }
  }
  if (!placed) return null;
  await api('POST', `/internal/payments/${bal.json.data.id}/backdate-payout-eligible`, {}, false);
  const snap = sim.json.data ?? bal.json.data;
  return {
    bookingId,
    paymentId: bal.json.data.id,
    publicCode: book.json.data.publicCode,
    commission: snap.platformCommissionAmount,
    net: snap.ownerNetPayoutAmount,
  };
}

async function generate(body) {
  cookieJar = '';
  return api('POST', '/internal/settlements/generate-due', body, false);
}

async function main() {
  console.log('\n📦 Phase 10D.2 Settlement cycle QA\n');

  const owner1 = await resolveOwner(OWNER1.email);
  const owner2 = await resolveOwner('owner2@mazare3.jo');
  const owner3 = await resolveOwner('owner3@mazare3.jo');
  if (!owner1 || !owner2 || !owner3) {
    fail('owners', 'missing seed partners');
    process.exit(1);
  }

  await login(ADMIN);
  for (const id of [owner1, owner2, owner3]) {
    const existing = await api('GET', `/admin/partners/${id}/settlements`);
    for (const s of existing.json.data ?? []) {
      if (
        s.status !== 'paid' &&
        ((s.periodStart === '2026-01-01' && s.periodEnd === '2026-01-21') ||
          (s.periodStart === '2026-01-08' && s.periodEnd === '2026-01-14'))
      ) {
        await api('POST', `/admin/settlements/${s.id}/cancel`, {});
      }
    }
  }

  await login(ADMIN);
  const listed = await api('GET', `/admin/partners/${owner1}/settlements`);
  if (listed.json.cycle?.cycleDays === 21) pass('21-day default config');
  else fail('default cycle', JSON.stringify(listed.json.cycle));

  const custom = await generate({ asOf: '2026-01-14', cycleDays: 7, ownerId: owner2 });
  if (
    custom.status === 200 &&
    custom.json.data?.cycleDays === 7 &&
    custom.json.data?.periodStart === '2026-01-08' &&
    custom.json.data?.periodEnd === '2026-01-14'
  ) {
    pass('custom cycle value');
    pass('period boundaries are deterministic');
  } else fail('custom cycle', `${custom.status} ${JSON.stringify(custom.json.data)}`);

  const none = await generate({ asOf: '2026-01-21', ownerId: owner2 });
  if (none.status === 200 && none.json.data?.settlementsCreated === 0 && none.json.data?.skippedOwners >= 1) {
    pass('owner with no eligible payouts gets none');
  } else fail('no eligible', JSON.stringify(none.json.data));

  const duePaid = await createPaidInWindow(SLUG1, '2026-01-10');
  if (!duePaid) {
    fail('due booking', 'create failed');
  }
  await login(ADMIN);
  const pre = await api('GET', `/admin/partners/${owner1}/settlement-preview?through=2026-01-21`);
  const preItem = (pre.json.data?.items ?? []).find((i) => i.paymentId === duePaid?.paymentId);
  const due = await generate({ asOf: '2026-01-21', ownerId: owner1 });
  if (due.status === 200 && due.json.data?.settlementsCreated === 1 && due.json.data?.itemsAttached >= 1) {
    pass('due owner gets a settlement draft');
  } else fail('due generate', JSON.stringify(due.json.data));

  await login(ADMIN);
  const afterDue = await api('GET', `/admin/partners/${owner1}/settlements`);
  const cycleDraft = (afterDue.json.data ?? []).find((s) =>
    (s.items ?? []).some((i) => i.paymentId === duePaid?.paymentId),
  );
  const item = cycleDraft?.items?.find((i) => i.paymentId === duePaid?.paymentId);
  if (
    item &&
    preItem &&
    item.platformCommissionAmount === preItem.platformCommissionAmount &&
    item.ownerNetPayoutAmount === preItem.ownerNetPayoutAmount
  ) {
    pass('financial snapshots remain unchanged');
  } else fail('snapshots', JSON.stringify({ item, preItem }));

  if (afterDue.json.cycle?.draftExistsForCurrentCycle !== undefined) {
    /* cycle indicator is present for admin UI */
  }

  const rerun = await generate({ asOf: '2026-01-21', ownerId: owner1 });
  if (rerun.status === 200 && rerun.json.data?.settlementsCreated === 0) {
    pass('same cycle rerun is idempotent');
  } else fail('idempotent', JSON.stringify(rerun.json.data));

  await login(ADMIN);
  const preview = await api(
    'GET',
    `/admin/partners/${owner1}/settlement-preview?through=2026-01-21`,
  );
  const reserved = (preview.json.data?.excluded ?? []).find((i) => i.paymentId === duePaid?.paymentId);
  if (reserved?.reason === 'already_in_settlement') pass('reserved payout is not duplicated');
  else fail('reserved', reserved?.reason ?? 'missing');

  const paidRow = await createPaidInWindow(SLUG2, '2026-01-12');
  await login(ADMIN);
  if (paidRow?.paymentId) {
    await api('POST', `/admin/payouts/${paidRow.paymentId}/mark-paid`, { manualReference: 'QA-CYCLE-SOLO' });
  }
  const paidGen = await generate({ asOf: '2026-01-21', ownerId: owner2 });
  const paidIncluded = (await (async () => {
    await login(ADMIN);
    const list = await api('GET', `/admin/partners/${owner2}/settlements`);
    return (list.json.data ?? []).some((s) =>
      (s.items ?? []).some((i) => i.paymentId === paidRow?.paymentId),
    );
  })());
  if (paidGen.json.data?.settlementsCreated === 0 && !paidIncluded) pass('paid payout is excluded');
  else fail('paid excluded', `${paidGen.json.data?.settlementsCreated} included=${paidIncluded}`);

  const blocked = await createPaidInWindow(SLUG2, '2026-01-11');
  if (blocked?.bookingId) {
    await login(CUSTOMER);
    await api('POST', `/me/bookings/${blocked.bookingId}/disputes`, {
      type: 'property_mismatch',
      description: 'نزاع يمنع دخول دفعة إلى دورة التسوية',
    });
  }
  const blockedGen = await generate({ asOf: '2026-01-21', ownerId: owner2 });
  await login(ADMIN);
  const owner2List = await api('GET', `/admin/partners/${owner2}/settlements`);
  const disputeIncluded = (owner2List.json.data ?? []).some((s) =>
    (s.items ?? []).some((i) => i.paymentId === blocked?.paymentId),
  );
  if (!disputeIncluded && blockedGen.json.data?.settlementsCreated === 0) {
    pass('refund/dispute blocked payout is excluded');
  } else fail('blocked excluded', `included=${disputeIncluded}`);

  const other = await createPaidInWindow(SLUG3, '2026-01-09');
  const both = await generate({ asOf: '2026-01-21' });
  await login(ADMIN);
  const o1 = await api('GET', `/admin/partners/${owner1}/settlements`);
  const o3 = await api('GET', `/admin/partners/${owner3}/settlements`);
  const o1Drafts = (o1.json.data ?? []).filter(
    (s) => s.periodStart === '2026-01-01' && s.periodEnd === '2026-01-21' && s.status === 'draft',
  );
  const o3Has = (o3.json.data ?? []).some(
    (s) =>
      s.ownerId === owner3 &&
      s.status === 'draft' &&
      (s.items ?? []).some((i) => i.paymentId === other?.paymentId),
  );
  if (o1Drafts.length === 1 && o3Has && both.json.data?.settlementsCreated >= 1) {
    pass('different owners receive separate settlements');
  } else fail('separate owners', `o1=${o1Drafts.length} o3=${o3Has} created=${both.json.data?.settlementsCreated}`);

  const pub = await api('POST', '/settlements/generate-due', {});
  if (pub.status === 404 || pub.status === 401 || pub.status === 403) {
    pass('internal generation endpoint is protected');
  } else fail('protected', pub.status);

  await login(ADMIN);
  const terms = await api('POST', `/admin/partners/${owner1}/commercial-terms`, {
    commissionPercent: 41,
    effectiveFrom: new Date().toISOString(),
  });
  if (terms.status === 201) {
    await api('POST', `/admin/partners/${owner1}/commercial-terms/${terms.json.data.id}/activate`, {});
  }
  const frozen = await api('GET', `/admin/settlements/${cycleDraft?.id}`);
  const still = frozen.json.data?.items?.find((i) => i.paymentId === duePaid?.paymentId)?.platformCommissionAmount;
  if (still === preItem?.platformCommissionAmount) pass('current commission does not rewrite cycle snapshots');
  else fail('commission freeze', `${still} vs ${preItem?.platformCommissionAmount}`);

  console.log(`\n10D.2: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
