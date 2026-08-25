/**
 * Phase 10B.2 — availability search API QA
 * Prefer: pnpm qa:api
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

const RUN = `sr-${Date.now()}`;
const IMAGES = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
];

let cookieJar = '';
let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  ❌ ${name}: ${detail}`);
}
const failures = [];

async function api(method, path, body, useCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

function allWeekRules() {
  const periods = [
    { period: 'morning', startTime: '09:00', endTime: '13:00', price: 140 },
    { period: 'evening', startTime: '16:00', endTime: '22:00', price: 210 },
    { period: 'full_day', startTime: '08:00', endTime: '20:00', price: 320 },
    { period: 'overnight', startTime: '20:00', endTime: '10:00', price: 360 },
  ];
  const rules = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (const p of periods) rules.push({ weekday, enabled: true, ...p });
  }
  return rules;
}

async function createProperty(titleEn, extra = {}) {
  return api('POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة بحث ${titleEn}`,
    titleEn,
    descriptionAr: 'وصف تجريبي لمزرعة اختبار البحث حسب التوفر والسعر الدقيق في المنصة.',
    descriptionEn: 'Search QA farm used for availability-backed marketplace results.',
    city: 'amman',
    area: `qa-search-${RUN}`,
    approximateAddress: 'عمان — اختبار البحث',
    exactAddress: 'عنوان دقيق مخفي لاختبار البحث',
    basePrice: 500,
    capacity: extra.capacity ?? 18,
    imageUrls: IMAGES,
    amenityKeys: extra.amenityKeys ?? ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
}

async function publish(propId) {
  await login(OWNER1);
  await api('POST', `/owner/properties/${propId}/submit-review`);
  await login(ADMIN);
  return api('PATCH', `/admin/properties/${propId}/status`, { status: 'published' });
}

function plusDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('\n🔎 Phase 10B.2 search API QA\n');

  const past = await api('GET', '/properties?date=2020-01-01', null, false);
  if (past.status === 400 && past.json.code === 'PAST_DATE') pass('past date rejected');
  else fail('past date rejected', `${past.status} ${past.json.code}`);

  const invalid = await api('GET', '/properties?date=not-a-date', null, false);
  if (invalid.status === 400) pass('invalid date rejected');
  else fail('invalid date rejected', String(invalid.status));

  const unpublished = await api('GET', '/properties?q=draft', null, false);
  if (unpublished.status === 200 && Array.isArray(unpublished.json.data)) {
    const leaked = unpublished.json.data.some((p) => p.status && p.status !== 'published');
    if (!leaked) pass('published properties only (no status leak)');
    else fail('published properties only', 'status present');
  } else fail('published properties only', String(unpublished.status));

  await login(OWNER1);
  const created = await createProperty(`QA Search ${RUN}`);
  if (created.status !== 201) {
    fail('create search property', `status ${created.status}`);
    console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }
  const propId = created.json.data.id;
  const slug = created.json.data.slug;
  await api('PUT', `/owner/properties/${propId}/availability-rules`, { rules: allWeekRules() });
  await api('POST', `/owner/properties/${propId}/availability/generate`, {});
  const pub = await publish(propId);
  if (pub.status !== 200) fail('publish search property', `${pub.status}`);
  else pass('publish search property');

  const date = plusDays(21);
  const nextMorning = plusDays(22);

  let r = await api(
    'GET',
    `/properties?date=${date}&period=morning&city=amman&area=qa-search-${RUN}`,
    null,
    false,
  );
  const hit = r.json.data?.find((p) => p.id === propId);
  if (r.status === 200 && hit?.searchMatch?.slotPrice === 140 && hit.pricingMode === 'exact_slot') {
    pass('search by exact date and period');
    pass('exact slot-price response');
  } else fail('exact date/period', JSON.stringify(hit?.searchMatch));

  if (hit?.searchMatch?.depositAmount != null && hit.searchMatch.remainingAmount != null) {
    const sum = Number(hit.searchMatch.depositAmount) + Number(hit.searchMatch.remainingAmount);
    if (Math.abs(sum - 140) < 0.02) pass('deposit and remaining-amount response');
    else fail('deposit remaining', `${sum} vs 140`);
  } else fail('deposit remaining', 'missing');

  if (hit?.searchMatch?.startAtLocal && hit.searchMatch.endAtLocal) {
    pass('timed start/end on search match');
  } else fail('timed start/end', JSON.stringify(hit?.searchMatch));

  r = await api('GET', `/properties?date=${date}&area=qa-search-${RUN}`, null, false);
  const any = r.json.data?.find((p) => p.id === propId);
  if (any?.searchMatch?.matchingPeriodsCount >= 2) pass('search by date with any matching period');
  else fail('date any period', String(any?.searchMatch?.matchingPeriodsCount));

  r = await api('GET', `/properties?city=amman&area=qa-search-${RUN}`, null, false);
  if (r.json.data?.some((p) => p.id === propId) && r.json.meta?.mode === 'browse') {
    pass('search by city or area (browse)');
  } else fail('city/area browse', r.json.meta?.mode);

  const browseCard = r.json.data?.find((p) => p.id === propId);
  if (browseCard?.pricingMode === 'browse_from' && browseCard.basePrice === 500) {
    pass('no-date browse pricing labels (From basePrice, not slot)');
  } else fail('browse pricing', JSON.stringify(browseCard?.pricingMode));

  r = await api('GET', `/properties?date=${date}&area=qa-search-${RUN}&guests=99`, null, false);
  if (!r.json.data?.some((p) => p.id === propId)) pass('guest count capacity filtering');
  else fail('guest capacity', 'still returned');

  await login(OWNER1);
  const slots = await api('GET', `/owner/availability?propertyId=${propId}&from=${date}&to=${nextMorning}`);
  const morning = slots.json.data?.find((s) => s.date === date && s.period === 'morning');
  const evening = slots.json.data?.find((s) => s.date === date && s.period === 'evening');
  const fullDay = slots.json.data?.find((s) => s.date === date && s.period === 'full_day');
  const overnight = slots.json.data?.find((s) => s.date === date && s.period === 'overnight');
  const nextM = slots.json.data?.find((s) => s.date === nextMorning && s.period === 'morning');

  if (morning?.id) {
    await api('PATCH', `/owner/availability/${morning.id}`, { status: 'blocked' });
  }
  r = await api('GET', `/properties?date=${date}&period=morning&area=qa-search-${RUN}`, null, false);
  if (!r.json.data?.some((p) => p.id === propId)) pass('blocked slot exclusion');
  else fail('blocked exclusion', 'property still listed');
  if (morning?.id) await api('PATCH', `/owner/availability/${morning.id}`, { status: 'available' });

  await login(CUSTOMER);
  const booked = await api('POST', '/bookings', {
    propertySlug: slug,
    date,
    period: 'evening',
    guestsCount: 4,
  });
  r = await api('GET', `/properties?date=${date}&period=evening&area=qa-search-${RUN}`, null, false);
  if (booked.status === 201 && !r.json.data?.some((p) => p.id === propId)) pass('booked slot exclusion');
  else fail('booked exclusion', `${booked.status}`);

  r = await api('GET', `/properties?date=${date}&period=full_day&area=qa-search-${RUN}`, null, false);
  if (!r.json.data?.some((p) => p.id === propId)) pass('cross-period overlap exclusion');
  else fail('full_day overlap', 'still listed');

  if (booked.json.data?.id) {
    await api('POST', `/me/bookings/${booked.json.data.id}/cancel`, {});
  }

  const hold = await api('POST', '/bookings', {
    propertySlug: slug,
    date,
    period: 'morning',
    guestsCount: 4,
  });
  r = await api('GET', `/properties?date=${date}&period=morning&area=qa-search-${RUN}`, null, false);
  if (hold.status === 201 && !r.json.data?.some((p) => p.id === propId)) pass('active hold exclusion');
  else fail('hold exclusion', `${hold.status}`);

  if (hold.json.data?.id) {
    await api('POST', `/me/bookings/${hold.json.data.id}/cancel`, {});
  }
  r = await api('GET', `/properties?date=${date}&period=morning&area=qa-search-${RUN}`, null, false);
  if (r.json.data?.some((p) => p.id === propId)) pass('expired/cancelled hold availability');
  else fail('hold release search', 'missing');

  const ov = await api('POST', '/bookings', {
    propertySlug: slug,
    date,
    period: 'overnight',
    guestsCount: 4,
  });
  r = await api('GET', `/properties?date=${nextMorning}&period=morning&area=qa-search-${RUN}`, null, false);
  if (ov.status === 201 && !r.json.data?.some((p) => p.id === propId)) {
    pass('overnight overlap exclusion');
  } else fail('overnight overlap search', `${ov.status} listed=${Boolean(r.json.data?.some((p) => p.id === propId))}`);
  if (ov.json.data?.id) await api('POST', `/me/bookings/${ov.json.data.id}/cancel`, {});

  r = await api(
    'GET',
    `/properties?date=${date}&area=qa-search-${RUN}&sort=price_asc`,
    null,
    false,
  );
  const prices = (r.json.data ?? [])
    .filter((p) => p.searchMatch?.slotPrice != null)
    .map((p) => p.searchMatch.slotPrice);
  const sorted = [...prices].sort((a, b) => a - b);
  if (prices.length && prices.every((v, i) => v === sorted[i])) pass('price low-to-high with exact slot prices');
  else fail('price_asc', JSON.stringify(prices));

  r = await api(
    'GET',
    `/properties?date=${date}&area=qa-search-${RUN}&sort=price_desc`,
    null,
    false,
  );
  const desc = (r.json.data ?? [])
    .filter((p) => p.searchMatch?.slotPrice != null)
    .map((p) => p.searchMatch.slotPrice);
  const descSorted = [...desc].sort((a, b) => b - a);
  if (desc.length && desc.every((v, i) => v === descSorted[i])) pass('price high-to-low sorting');
  else fail('price_desc', JSON.stringify(desc));

  const rec1 = await api('GET', `/properties?date=${date}&area=qa-search-${RUN}&sort=recommended`, null, false);
  const rec2 = await api('GET', `/properties?date=${date}&area=qa-search-${RUN}&sort=recommended`, null, false);
  const ids1 = (rec1.json.data ?? []).map((p) => p.id).join(',');
  const ids2 = (rec2.json.data ?? []).map((p) => p.id).join(',');
  if (ids1 === ids2) pass('stable recommended ordering');
  else fail('recommended stability', `${ids1} vs ${ids2}`);

  const p1 = await api('GET', `/properties?area=qa-search-${RUN}&page=1&pageSize=1`, null, false);
  const p2 = await api('GET', `/properties?area=qa-search-${RUN}&page=1&pageSize=1`, null, false);
  if (p1.json.data?.[0]?.id === p2.json.data?.[0]?.id) pass('pagination stability');
  else fail('pagination', `${p1.json.data?.[0]?.id} vs ${p2.json.data?.[0]?.id}`);

  const multi = await api('GET', `/properties?date=${date}&area=qa-search-${RUN}`, null, false);
  const idCounts = new Map();
  for (const p of multi.json.data ?? []) idCounts.set(p.id, (idCounts.get(p.id) ?? 0) + 1);
  if ([...idCounts.values()].every((n) => n === 1)) pass('no duplicate properties from multiple matching slots');
  else fail('duplicates', JSON.stringify([...idCounts]));

  const disc = await api('GET', `/properties/discovery?city=amman`, null, false);
  if (disc.status === 200 && Array.isArray(disc.json.data?.sections)) pass('discovery endpoint read-only');
  else fail('discovery', String(disc.status));

  const alt = await api(
    'GET',
    `/properties?date=${date}&period=morning&minPrice=10000&area=qa-search-${RUN}`,
    null,
    false,
  );
  if (alt.json.meta?.suggestions?.tryWithoutDate) pass('empty-result suggestions use real meta');
  else fail('suggestions', JSON.stringify(alt.json.meta?.suggestions));

  const reval = await api('POST', '/bookings', {
    propertySlug: slug,
    date,
    period: 'morning',
    guestsCount: 4,
  });
  if (reval.status === 201) {
    const again = await api('POST', '/bookings', {
      propertySlug: slug,
      date,
      period: 'morning',
      guestsCount: 4,
    });
    if (again.status === 409 && again.json.code === 'SLOT_UNAVAILABLE') {
      pass('booking revalidation after search');
    } else fail('revalidation', `${again.status} ${again.json.code}`);
    await api('POST', `/me/bookings/${reval.json.data.id}/cancel`, {});
  } else fail('revalidation booking', String(reval.status));

  const legacyList = await api('GET', '/properties?date=' + plusDays(40) + '&q=chalet-emerald', null, false);
  if (legacyList.status === 200) pass('legacy/browse mix does not 500');
  else fail('legacy mix', String(legacyList.status));

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failed) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
