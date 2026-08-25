/**
 * Phase 10H.3B — Customer support tickets (communication only).
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

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

async function createBooking() {
  await login(CUSTOMER);
  const slot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const book = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount: 2,
  });
  if (book.status !== 201) return null;
  return book.json.data;
}

function snapshot(booking) {
  return {
    status: booking.status,
    paymentState: booking.paymentState,
    cancelledAt: booking.cancelledAt ?? null,
    refundRequest: booking.refundRequest ?? null,
  };
}

async function main() {
  console.log('\n📦 Phase 10H.3B Support QA\n');

  const guestContact = await api(
    'POST',
    '/support/contact',
    {
      name: 'Guest Visitor',
      email: `guest-support-${Date.now()}@example.com`,
      subject: 'General contact test',
      message: 'I have a general question about Mazare3 bookings.',
    },
    false,
  );
  if (guestContact.status === 201 && guestContact.json.data?.publicCode?.startsWith('SP-')) {
    pass('anonymous general contact creates a ticket');
  } else {
    fail('anonymous contact', `${guestContact.status} ${JSON.stringify(guestContact.json)}`);
  }

  const guestEmailBody = {
    name: 'Guest Visitor',
    email: `guest-support-dup-${Date.now()}@example.com`,
    subject: 'Duplicate window check',
    message: 'This should only succeed once in the duplicate window.',
  };
  const firstDup = await api('POST', '/support/contact', guestEmailBody, false);
  const secondDup = await api('POST', '/support/contact', guestEmailBody, false);
  if (firstDup.status === 201 && secondDup.status === 409 && secondDup.json.code === 'SUPPORT_TICKET_DUPLICATE') {
    pass('duplicate accidental general submit is rejected');
  } else {
    fail('duplicate general', `${firstDup.status}/${secondDup.status} ${secondDup.json.code}`);
  }

  const booking = await createBooking();
  if (!booking?.id) {
    fail('create booking', 'could not create customer booking');
    printSummary();
    process.exit(1);
  }

  const before = await api('GET', `/me/bookings/${booking.id}`);
  const beforeSnap = snapshot(before.json.data ?? {});

  const created = await api('POST', `/me/bookings/${booking.id}/support`, {
    category: 'booking_status',
    subject: 'Need help with this stay',
    message: 'The booking status is unclear and I need platform help.',
  });
  if (created.status === 201 && created.json.data?.bookingId === booking.id) {
    pass('customer can create a support issue for own booking');
  } else {
    fail('create booking ticket', `${created.status} ${JSON.stringify(created.json)}`);
  }

  const after = await api('GET', `/me/bookings/${booking.id}`);
  const afterSnap = snapshot(after.json.data ?? {});
  if (JSON.stringify(beforeSnap) === JSON.stringify(afterSnap)) {
    pass('support submit does not mutate booking/payment/refund state');
  } else {
    fail('financial mutation', JSON.stringify({ beforeSnap, afterSnap }));
  }

  const dupBooking = await api('POST', `/me/bookings/${booking.id}/support`, {
    category: 'payment',
    subject: 'Second attempt',
    message: 'Trying to submit the same booking issue again.',
  });
  if (dupBooking.status === 409 && dupBooking.json.code === 'SUPPORT_TICKET_OPEN') {
    pass('duplicate open booking ticket is rejected');
  } else {
    fail('duplicate booking ticket', `${dupBooking.status} ${dupBooking.json.code}`);
  }

  const ticketId = created.json.data?.id;
  const ownRead = await api('GET', `/me/support/${ticketId}`);
  if (ownRead.status === 200 && ownRead.json.data?.id === ticketId) {
    pass('customer can read own ticket');
  } else {
    fail('read own ticket', `${ownRead.status} ${ownRead.json.code}`);
  }

  await login(OWNER1);
  const ownerCreate = await api('POST', `/me/bookings/${booking.id}/support`, {
    category: 'other',
    subject: 'Owner trying this booking',
    message: 'This should be forbidden because it is not my booking.',
  });
  if (ownerCreate.status === 404) {
    pass('another account cannot create a ticket for someone else booking');
  } else {
    fail('foreign create', `${ownerCreate.status} ${ownerCreate.json.code}`);
  }
  const ownerRead = await api('GET', `/me/support/${ticketId}`);
  if (ownerRead.status === 404) {
    pass('another account cannot read someone else ticket');
  } else {
    fail('foreign read', `${ownerRead.status} ${ownerRead.json.code}`);
  }
  const ownerList = await api('GET', '/me/support');
  const leaked = (ownerList.json.data ?? []).some((row) => row.id === ticketId);
  if (ownerList.status === 200 && !leaked) {
    pass('owner list does not include private customer tickets');
  } else {
    fail('owner list leak', `${ownerList.status} leaked=${leaked}`);
  }

  const otherEmail = `support-other-${Date.now()}@mazare3.test`;
  cookieJar = '';
  const signup = await api(
    'POST',
    '/auth/signup',
    { name: 'Other Customer', email: otherEmail, password: 'Mazare3Demo2026!', locale: 'en' },
    false,
  );
  if (signup.status === 201 || signup.status === 200) {
    const otherCreate = await api('POST', `/me/bookings/${booking.id}/support`, {
      category: 'other',
      subject: 'Not my booking',
      message: 'Another customer should not open this ticket.',
    });
    const otherRead = await api('GET', `/me/support/${ticketId}`);
    if (otherCreate.status === 404 && otherRead.status === 404) {
      pass('second customer cannot open or read another customer ticket');
    } else {
      fail('second customer', `${otherCreate.status}/${otherRead.status}`);
    }
  } else {
    fail('signup second customer', `${signup.status} ${JSON.stringify(signup.json)}`);
  }

  await login(CUSTOMER);
  const authGeneral = await api('POST', '/support/contact', {
    subject: 'Signed-in general question',
    message: 'Authenticated general contact should attach my account.',
  });
  if (authGeneral.status === 201 && authGeneral.json.data?.source === 'general') {
    pass('authenticated general contact works');
  } else {
    fail('auth general', `${authGeneral.status} ${JSON.stringify(authGeneral.json)}`);
  }

  await login(ADMIN);
  const adminList = await api('GET', '/admin/support?source=booking');
  const listed = (adminList.json.data ?? []).find((row) => row.id === ticketId);
  if (adminList.status === 200 && listed) {
    pass('admin can list booking-related tickets');
  } else {
    fail('admin list', `${adminList.status} found=${Boolean(listed)}`);
  }

  const adminOpen = await api('GET', `/admin/support/${ticketId}`);
  if (adminOpen.status === 200 && adminOpen.json.data?.bookingPublicCode) {
    pass('admin can open ticket with booking reference');
  } else {
    fail('admin open', `${adminOpen.status} ${JSON.stringify(adminOpen.json)}`);
  }

  const adminPatch = await api('PATCH', `/admin/support/${ticketId}`, {
    status: 'in_progress',
    adminResponse: 'We received your request and will review the booking status.',
  });
  if (adminPatch.status === 200 && adminPatch.json.data?.status === 'in_progress') {
    pass('admin can update status and post a customer-visible response');
  } else {
    fail('admin patch', `${adminPatch.status} ${JSON.stringify(adminPatch.json)}`);
  }

  await login(CUSTOMER);
  const afterReply = await api('GET', `/me/support/${ticketId}`);
  if (
    afterReply.status === 200 &&
    afterReply.json.data?.status === 'in_progress' &&
    afterReply.json.data?.adminResponse?.includes('review the booking')
  ) {
    pass('admin response is visible to the correct customer');
  } else {
    fail('customer sees reply', `${afterReply.status} ${JSON.stringify(afterReply.json.data)}`);
  }

  await login(OWNER1);
  const ownerAdmin = await api('GET', '/admin/support');
  if (ownerAdmin.status === 403) {
    pass('property partner cannot access admin support inbox');
  } else {
    fail('owner admin support', `${ownerAdmin.status}`);
  }
  const ownerSeesReply = await api('GET', `/me/support/${ticketId}`);
  if (ownerSeesReply.status === 404) {
    pass('admin response is not visible to the property partner');
  } else {
    fail('owner sees reply', `${ownerSeesReply.status}`);
  }

  await login(CUSTOMER);
  const notifs = await api('GET', '/me/notifications?limit=20');
  const supportNotif = (notifs.json.data?.items ?? []).some(
    (n) => n.type === 'support.response_posted' || n.type === 'support.status_changed',
  );
  if (notifs.status === 200 && supportNotif) {
    pass('in-app notification is created for support updates');
  } else {
    fail('support notification', `${notifs.status} types=${(notifs.json.data?.items ?? []).map((n) => n.type).join(',')}`);
  }

  printSummary();
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`   • ${f.name}: ${f.detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
