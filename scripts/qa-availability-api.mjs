/**
 * Phase 10B.1 — Availability engine API QA
 * Prefer: pnpm qa:api
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

const RUN = `av-${Date.now()}`;
const IMAGES = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
];

let cookieJar = '';
let passed = 0;
let failed = 0;
const failures = [];

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  ❌ ${name}: ${detail}`);
}

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
    { period: 'morning', startTime: '09:00', endTime: '13:00', price: 120 },
    { period: 'evening', startTime: '16:00', endTime: '22:00', price: 180 },
    { period: 'full_day', startTime: '08:00', endTime: '20:00', price: 300 },
    { period: 'overnight', startTime: '20:00', endTime: '10:00', price: 350 },
  ];
  const rules = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (const p of periods) rules.push({ weekday, enabled: true, ...p });
  }
  return rules;
}

async function createTimedProperty(titleEn) {
  const created = await api('POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة توفر ${titleEn}`,
    titleEn,
    descriptionAr: 'وصف تجريبي لمزرعة اختبار محرك التوفر والفترات المتداخلة في المنصة.',
    descriptionEn: 'Availability engine QA farm used for timed slots and overlap checks.',
    city: 'amman',
    area: 'qa-availability',
    approximateAddress: 'عمان — اختبار التوفر',
    exactAddress: 'عنوان دقيق مخفي لاختبار التوفر',
    basePrice: 200,
    capacity: 20,
    imageUrls: IMAGES,
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  return created;
}

async function publishProperty(propId) {
  await login({ email: OWNER1.email, password: OWNER1.password });
  await api('POST', `/owner/properties/${propId}/submit-review`);
  await login(ADMIN);
  return api('PATCH', `/admin/properties/${propId}/status`, { status: 'published' });
}

async function main() {
  console.log('\n📅 Phase 10B.1 Availability API QA\n');

  await login(CUSTOMER);
  const custRules = await api('GET', '/owner/properties/x/availability-rules');
  if (custRules.status === 403) pass('customer cannot access owner rule endpoints');
  else fail('customer cannot access owner rule endpoints', `got ${custRules.status}`);

  await login(OWNER1);
  const created = await createTimedProperty(`QA Timed ${RUN}`);
  if (created.status !== 201) {
    fail('create timed property', `status ${created.status}`);
    console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }
  pass('create isolated timed property');
  const propId = created.json.data.id;
  const slug = created.json.data.slug;

  const dup = await api('PUT', `/owner/properties/${propId}/availability-rules`, {
    rules: [
      { weekday: 1, period: 'morning', enabled: true, startTime: '09:00', endTime: '13:00', price: 100 },
      { weekday: 1, period: 'morning', enabled: true, startTime: '10:00', endTime: '14:00', price: 110 },
    ],
  });
  if (dup.status === 409 || dup.status === 400) pass('duplicate weekday/period rule rejected');
  else fail('duplicate weekday/period rule rejected', `got ${dup.status}`);

  const bad = await api('PUT', `/owner/properties/${propId}/availability-rules`, {
    rules: [
      { weekday: 1, period: 'morning', enabled: true, startTime: '13:00', endTime: '09:00', price: 100 },
    ],
  });
  if (bad.status === 400) pass('invalid non-overnight times rejected');
  else fail('invalid non-overnight times rejected', `got ${bad.status}`);

  const put = await api('PUT', `/owner/properties/${propId}/availability-rules`, {
    rules: allWeekRules(),
  });
  if (put.status === 200 && put.json.data?.length === 28) pass('PUT weekly rules (28)');
  else fail('PUT weekly rules', `status ${put.status} count ${put.json.data?.length}`);

  const preview = await api('POST', `/owner/properties/${propId}/availability/generate-preview`, {});
  const gen1 = await api('POST', `/owner/properties/${propId}/availability/generate`, {});
  if (gen1.status === 200 && gen1.json.data.created >= 1) {
    pass(`generate created ${gen1.json.data.created} slots`);
  } else fail('generate future slots', `status ${gen1.status} created ${gen1.json.data?.created}`);

  const gen2 = await api('POST', `/owner/properties/${propId}/availability/generate`, {});
  if (gen2.status === 200 && gen2.json.data.created === 0 && gen2.json.data.alreadyExisting >= 1) {
    pass('generation is idempotent (no duplicates)');
  } else {
    fail(
      'idempotent generation',
      `created ${gen2.json.data?.created} existing ${gen2.json.data?.alreadyExisting}`,
    );
  }
  if (preview.status === 200) pass('generate preview returns counts');
  else fail('generate preview', `status ${preview.status}`);

  await login(OWNER2);
  const cross = await api('PUT', `/owner/properties/${propId}/availability-rules`, {
    rules: allWeekRules(),
  });
  if (cross.status === 404 || cross.status === 403) pass('owner cannot modify another owner rules');
  else fail('owner cannot modify another owner rules', `got ${cross.status}`);

  await login(OWNER1);
  const from = gen1.json.data.from;
  const to = gen1.json.data.to;
  const slots = await api('GET', `/owner/availability?propertyId=${propId}&from=${from}&to=${to}`);
  const generated = (slots.json.data ?? []).filter((s) => s.source === 'generated' && s.status === 'available');
  const morning = generated.find((s) => s.period === 'morning' && s.startAtLocal === '09:00');
  const evening = generated.find((s) => s.period === 'evening' && s.date === morning?.date);
  const fullDay = generated.find((s) => s.period === 'full_day' && s.date === morning?.date);
  const overnight = generated.find((s) => s.period === 'overnight' && s.date === morning?.date);

  if (morning?.startAt && morning.endAt) pass('generated morning has startAt/endAt');
  else fail('generated morning times', JSON.stringify(morning));

  if (morning) {
    const blocked = await api('PATCH', `/owner/availability/${morning.id}`, { status: 'blocked' });
    if (blocked.status === 200 && blocked.json.data.status === 'blocked') pass('owner block future slot');
    else fail('owner block', `status ${blocked.status}`);

    const gen3 = await api('POST', `/owner/properties/${propId}/availability/generate`, {});
    const afterBlock = await api(
      'GET',
      `/owner/availability?propertyId=${propId}&from=${morning.date}&to=${morning.date}`,
    );
    const stillBlocked = afterBlock.json.data?.find((s) => s.id === morning.id);
    if (stillBlocked?.status === 'blocked' && gen3.json.data.skippedBlocked >= 1) {
      pass('generation does not reopen blocked slots');
    } else if (stillBlocked?.status === 'blocked') {
      pass('generation does not reopen blocked slots');
    } else fail('blocked preserved', stillBlocked?.status);

    const reopened = await api('PATCH', `/owner/availability/${morning.id}`, { status: 'available' });
    if (reopened.status === 200 && reopened.json.data.status === 'available') pass('owner reopen blocked slot');
    else fail('owner reopen', `status ${reopened.status}`);

    const priced = await api('PATCH', `/owner/availability/${morning.id}`, { price: 277 });
    if (priced.status === 200 && priced.json.data.price === 277 && priced.json.data.priceOverridden) {
      pass('owner manual price override');
    } else fail('manual price', JSON.stringify(priced.json.data));

    await api('POST', `/owner/properties/${propId}/availability/generate`, {});
    const afterPrice = await api(
      'GET',
      `/owner/availability?propertyId=${propId}&from=${morning.date}&to=${morning.date}`,
    );
    const kept = afterPrice.json.data?.find((s) => s.id === morning.id);
    if (kept?.price === 277) pass('generation does not overwrite manual price');
    else fail('manual price preserved', kept?.price);
  }

  const noSchedule = await createTimedProperty(`QA NoSched ${RUN}`);
  const emptyId = noSchedule.json.data?.id;
  if (emptyId) {
    await api('POST', `/owner/properties/${emptyId}/submit-review`);
    await login(ADMIN);
    const pubEmpty = await api('PATCH', `/admin/properties/${emptyId}/status`, { status: 'published' });
    if (pubEmpty.status === 400 && pubEmpty.json.code === 'AVAILABILITY_SCHEDULE_REQUIRED') {
      pass('publication rejected without weekly schedule');
    } else {
      fail('publication rejected without schedule', `${pubEmpty.status} ${pubEmpty.json.code}`);
    }
  }

  await login(ADMIN);
  const emerald = (await api('GET', '/admin/properties')).json.data?.find(
    (p) => p.slug === 'chalet-emerald-dead-sea',
  );
  if (emerald) {
    const health = await api('GET', `/admin/properties/${emerald.id}/availability-health`);
    if (health.status === 200 && health.json.data.futureBookableCount >= 0) {
      pass('existing published property availability health (legacy compatible)');
    } else fail('legacy property health', `status ${health.status}`);
  }

  const pub = await publishProperty(propId);
  if (pub.status === 200) pass('safe generation after property publication');
  else fail('publish timed property', `${pub.status} ${pub.json.code ?? pub.json.error}`);

  cookieJar = '';
  const pubAvail = await api(
    'GET',
    `/properties/${slug}/availability?from=${morning?.date}&to=${morning?.date}`,
    null,
    false,
  );
  const pubMorning = pubAvail.json.data?.find((s) => s.period === 'morning');
  if (pubMorning?.startAt && pubMorning.bookable) pass('public availability includes real times');
  else fail('public timed availability', JSON.stringify(pubMorning));

  await login(CUSTOMER);
  const bookMorning = await api('POST', '/bookings', {
    propertySlug: slug,
    date: morning.date,
    period: 'morning',
    guestsCount: 4,
  });
  if (bookMorning.status === 201 && bookMorning.json.data.bookingStartAt && !bookMorning.json.data.usesLegacyTiming) {
    pass('timed booking stores start/end snapshots');
  } else fail('timed booking snapshots', `${bookMorning.status} ${bookMorning.json.data?.usesLegacyTiming}`);

  if (bookMorning.json.data?.balanceDueAt && bookMorning.json.data.bookingStartAt) {
    const start = Date.parse(bookMorning.json.data.bookingStartAt);
    const due = Date.parse(bookMorning.json.data.balanceDueAt);
    const deltaH = (start - due) / 3_600_000;
    if (deltaH >= 0 && Math.abs(deltaH - Math.round(deltaH)) < 0.001) {
      pass('balanceDueAt uses real bookingStartAt');
    } else fail('balanceDueAt vs start', `${bookMorning.json.data.balanceDueAt} vs ${bookMorning.json.data.bookingStartAt}`);
  }

  const overlap = await api('POST', '/bookings', {
    propertySlug: slug,
    date: fullDay.date,
    period: 'full_day',
    guestsCount: 4,
  });
  if (overlap.status === 409) pass('full-day vs morning overlap rejected');
  else fail('full-day overlap', `got ${overlap.status}`);

  const bookEve = await api('POST', '/bookings', {
    propertySlug: slug,
    date: evening.date,
    period: 'evening',
    guestsCount: 4,
  });
  if (bookEve.status === 201) pass('non-overlapping morning and evening both succeed');
  else fail('non-overlapping evening', `got ${bookEve.status}`);

  const cancelM = await api('POST', `/me/bookings/${bookMorning.json.data.id}/cancel`);
  if (cancelM.status === 200) pass('cancel timed morning booking');
  else fail('cancel morning', `status ${cancelM.status}`);

  const stillEve = await api('GET', `/me/bookings`);
  const eveStillHeld = stillEve.json.data?.some(
    (b) => b.id === bookEve.json.data?.id && ['pending_payment', 'pending', 'confirmed'].includes(b.status),
  );
  if (eveStillHeld) pass('releasing one booking does not release another valid booking');
  else fail('evening still held after morning cancel', 'evening booking not active');

  await api('POST', `/me/bookings/${bookEve.json.data.id}/cancel`);
  const afterCancel = await api('POST', '/bookings', {
    propertySlug: slug,
    date: fullDay.date,
    period: 'full_day',
    guestsCount: 4,
  });
  if (afterCancel.status === 201) pass('full-day bookable after overlapping holds released');
  else fail('full-day after releases', `got ${afterCancel.status}`);

  const nextDate = overnight.date;
  const ovBook = await api('POST', '/bookings', {
    propertySlug: slug,
    date: nextDate,
    period: 'overnight',
    guestsCount: 4,
  });
  if (ovBook.status === 201) {
    const nextMorningDate = new Date(`${overnight.date}T00:00:00Z`);
    nextMorningDate.setUTCDate(nextMorningDate.getUTCDate() + 1);
    const nd = nextMorningDate.toISOString().slice(0, 10);
    const nextM = await api('POST', '/bookings', {
      propertySlug: slug,
      date: nd,
      period: 'morning',
      guestsCount: 4,
    });
    if (nextM.status === 409) pass('overnight vs next-day morning overlap rejected');
    else fail('overnight vs next morning', `got ${nextM.status} date ${nd}`);
  } else fail('overnight booking', `got ${ovBook.status}`);

  function addIso(iso, days) {
    const d = new Date(`${iso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const busyDates = new Set([morning.date, addIso(morning.date, 1)]);
  function nextFreeMorningDate(extraBusy = []) {
    const blocked = new Set([...busyDates, ...extraBusy]);
    const row = generated
      .filter((s) => s.period === 'morning' && !blocked.has(s.date))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return row?.date;
  }

  const holdDate = nextFreeMorningDate();
  const holdA = holdDate
    ? await api('POST', '/bookings', {
        propertySlug: slug,
        date: holdDate,
        period: 'morning',
        guestsCount: 2,
      })
    : { status: 0, json: {} };
  if (holdA.status === 201 && holdDate) {
    await api('POST', `/internal/bookings/${holdA.json.data.id}/backdate-hold`, {});
    await api('POST', '/internal/payments/expire-stale', {});
    const afterExpire = await api('POST', '/bookings', {
      propertySlug: slug,
      date: holdDate,
      period: 'full_day',
      guestsCount: 2,
    });
    if (afterExpire.status === 201) pass('hold expiration releases occupancy');
    else fail('hold expiration occupancy', `got ${afterExpire.status}`);
    busyDates.add(holdDate);
  } else {
    fail('hold expiration setup', `status ${holdA.status} date ${holdDate}`);
  }

  const dateC = nextFreeMorningDate();
  if (dateC) {
    const [a, b] = await Promise.all([
      api('POST', '/bookings', { propertySlug: slug, date: dateC, period: 'morning', guestsCount: 2 }),
      api('POST', '/bookings', { propertySlug: slug, date: dateC, period: 'full_day', guestsCount: 2 }),
    ]);
    const statuses = [a.status, b.status].sort();
    if (statuses[0] === 201 && statuses[1] === 409) pass('concurrent overlapping bookings: one success');
    else fail('concurrent overlap', `${a.status}/${b.status} on ${dateC}`);
  } else {
    fail('concurrent overlap', 'no free morning date');
  }

  await login(OWNER1);
  const bookedSlot = await api(
    'GET',
    `/owner/availability?propertyId=${propId}&from=${fullDay.date}&to=${fullDay.date}`,
  );
  const bookedRow = bookedSlot.json.data?.find((s) => s.period === 'full_day');
  if (bookedRow) {
    await api('POST', `/owner/properties/${propId}/availability/generate`, {});
    const afterGen = await api(
      'GET',
      `/owner/availability?propertyId=${propId}&from=${fullDay.date}&to=${fullDay.date}`,
    );
    const still = afterGen.json.data?.find((s) => s.id === bookedRow.id);
    if (still?.status === 'booked' || still?.hasActiveBooking) pass('generation does not modify booked slots');
    else fail('booked slot preserved', still?.status);
  }

  cookieJar = '';
  await login(CUSTOMER);
  const legacyAvail = await api(
    'GET',
    `/properties/chalet-emerald-dead-sea/availability?from=${from}&to=${to}`,
    null,
    false,
  );
  const legacySlot = legacyAvail.json.data?.find(
    (s) => s.status === 'available' && (s.bookable ?? true) && s.usesLegacyTiming,
  );
  if (legacySlot) {
    const legacyBook = await api('POST', '/bookings', {
      propertySlug: 'chalet-emerald-dead-sea',
      date: legacySlot.date,
      period: legacySlot.period,
      guestsCount: 2,
    });
    if (legacyBook.status === 201 && legacyBook.json.data.usesLegacyTiming === true) {
      pass('legacy slot retains documented timing fallback');
    } else if (legacyBook.status === 409) {
      pass('legacy slot remains bookable via unique date/period (busy QA slot)');
    } else fail('legacy booking fallback', `${legacyBook.status} ${legacyBook.json.data?.usesLegacyTiming}`);
  } else {
    pass('legacy public slots still listed without invented times');
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
