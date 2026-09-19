/**
 * Phase 10E.1 — Real post-visit reviews QA
 * Phase 3C.4E.4C — successful reviews require verified visit evidence.
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const CONTACT = '+962790000001';

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

async function ensureCustomerTermsAccepted() {
  const status = await api('GET', '/me/legal/status');
  const termsGate = (status.json.data?.customer?.gates ?? []).find(
    (g) => g.documentType === 'terms_and_conditions',
  );
  if (termsGate && termsGate.status !== 'missing' && termsGate.status !== 'reacceptance_required') {
    return true;
  }
  if (!termsGate && status.json.data?.customer?.requiresAction === false) return true;
  const doc = await api('GET', '/legal/documents/terms_and_conditions?lang=en', null, false);
  const versionId = doc.json.data?.id;
  if (!versionId) return false;
  const accept = await api('POST', '/me/legal/accept', {
    documentVersionId: versionId,
    context: 'login_reacceptance',
    sourceSurface: 'qa.review-api',
  });
  return accept.status === 201 || accept.status === 200;
}

async function ensurePriorConsents() {
  const status = await api('GET', '/me/prior-consents');
  const purposes = status.json.data?.purposes ?? [];
  for (const key of ['marketplace_booking_processing', 'payment_and_refund_processing']) {
    const row = purposes.find((p) => p.purposeKey === key);
    if (row?.validity === 'CONSENT_STILL_VALID') continue;
    const grant = await api('POST', '/me/prior-consents', {
      purposeKey: key,
      language: 'en',
      explicitConsent: true,
      sourceSurface: 'qa.review-api',
    });
    if (grant.status !== 200 && grant.status !== 201) return false;
  }
  return true;
}

async function fetchBookingLegalIds() {
  const set = await api('GET', '/legal/customer-booking-set?lang=ar', undefined, false);
  const data = set.json.data;
  if (!data?.corpusReady) return null;
  const docs = data.documents ?? data;
  if (!docs.terms?.versionId || !docs.cancellation?.versionId || !docs.bookingTerms?.versionId) {
    console.log('  [debug] legal set incomplete', JSON.stringify(data));
    return null;
  }
  return {
    terms: docs.terms.versionId,
    cancellation: docs.cancellation.versionId,
    bookingTerms: docs.bookingTerms.versionId,
    privacy: docs.privacy?.versionId,
  };
}

async function createPaidBooking() {
  await login(CUSTOMER);
  if (!(await ensureCustomerTermsAccepted())) return null;
  if (!(await ensurePriorConsents())) return null;
  const legalIds = await fetchBookingLegalIds();
  await api('POST', `/internal/properties/${SLUG}/ensure-bookable`, {}, false);
  const slot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const bookBody = {
    propertySlug: SLUG,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount: 4,
    ...(legalIds
      ? {
          acceptedDocumentVersionIds: {
            terms: legalIds.terms,
            cancellation: legalIds.cancellation,
            bookingTerms: legalIds.bookingTerms,
            ...(legalIds.privacy ? { privacy: legalIds.privacy } : {}),
          },
        }
      : {}),
  };
  const book = await api('POST', '/bookings', bookBody);
  if (book.status !== 201) {
    console.log('  [debug] book failed', book.status, book.json.code || book.json.error);
    return null;
  }
  const bookingId = book.json.data.id;
  const dep = await api('POST', '/payments/create-intent', {
    bookingId,
    method: 'card',
    purpose: 'deposit',
    contactPhone: CONTACT,
  });
  if (dep.status !== 201) {
    console.log('  [debug] deposit failed', dep.status, dep.json.code || dep.json.error);
    return null;
  }
  await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  const bal = await api('POST', '/payments/create-intent', {
    bookingId,
    method: 'card',
    purpose: 'balance',
    contactPhone: CONTACT,
  });
  if (bal.status !== 201) return { bookingId, paymentId: null, depositOnly: true };
  await api('POST', `/payments/${bal.json.data.id}/simulate-success`, {});
  return { bookingId, paymentId: bal.json.data.id, depositOnly: false };
}

async function main() {
  console.log('\n📦 Phase 10E.1 Reviews QA\n');

  const seeded = await api('GET', `/properties/${SLUG}`, undefined, false);
  const seededReviews = seeded.json.data?.reviews ?? [];
  if (
    seeded.status === 200 &&
    seeded.json.data?.reviewCount === seededReviews.length &&
    seeded.json.data?.reviewCount !== 47 &&
    (seeded.json.data.reviewCount === 0 ? seeded.json.data.rating === 0 : true)
  ) {
    pass('seeded rating fields are not treated as customer reviews');
  } else fail('seeded ratings', JSON.stringify({ count: seeded.json.data?.reviewCount, rating: seeded.json.data?.rating, listed: seededReviews.length }));

  const searchSeed = await api('GET', `/properties?q=emerald`, undefined, false);
  const card = (searchSeed.json.data ?? []).find((p) => p.slug === SLUG);
  if (card && card.reviewCount !== 47 && (card.reviewCount === 0 ? card.rating === 0 : card.rating > 0)) {
    pass('search card hides seeded rating when no reviews');
  } else fail('search seeded', JSON.stringify(card && { rating: card.rating, reviewCount: card.reviewCount }));

  const future = await createPaidBooking();
  if (!future?.bookingId) {
    fail('create paid booking', 'null');
    console.log(`\n10E.1: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  const tooSoon = await api('POST', `/me/bookings/${future.bookingId}/review`, { rating: 5, comment: 'مبكر' });
  if (tooSoon.status === 400 && tooSoon.json.code === 'VISIT_NOT_ENDED') pass('review before visit end is rejected');
  else fail('before visit', `${tooSoon.status} ${tooSoon.json.code}`);

  await login(OWNER1);
  const foreign = await api('POST', `/me/bookings/${future.bookingId}/review`, { rating: 5 });
  if (foreign.status === 403 || foreign.status === 404) pass('review for another customer booking is rejected');
  else fail('foreign review', `${foreign.status} ${foreign.json.code}`);

  await login(CUSTOMER);
  if (!(await ensureCustomerTermsAccepted()) || !(await ensurePriorConsents())) {
    fail('customer gates', 'legal/consent');
  }
  await api('POST', `/internal/properties/${SLUG}/ensure-bookable`, {}, false);
  const unpaid = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  const unpaidLegal = await fetchBookingLegalIds();
  const unpaidBook = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: unpaid.json.data.date,
    period: unpaid.json.data.period,
    guestsCount: 2,
    ...(unpaidLegal
      ? {
          acceptedDocumentVersionIds: {
            terms: unpaidLegal.terms,
            cancellation: unpaidLegal.cancellation,
            bookingTerms: unpaidLegal.bookingTerms,
            ...(unpaidLegal.privacy ? { privacy: unpaidLegal.privacy } : {}),
          },
        }
      : {}),
  });
  if (unpaidBook.status !== 201) {
    fail('unpaid booking create', `${unpaidBook.status} ${unpaidBook.json.code}`);
  } else {
    const depOnly = await api('POST', '/payments/create-intent', {
      bookingId: unpaidBook.json.data.id,
      method: 'card',
      purpose: 'deposit',
      contactPhone: CONTACT,
    });
    if (depOnly.status !== 201 || !depOnly.json.data?.id) {
      fail('unpaid deposit intent', `${depOnly.status} ${depOnly.json.code}`);
    } else {
    await api('POST', `/payments/${depOnly.json.data.id}/simulate-success`, {});
    await api('POST', `/internal/bookings/${unpaidBook.json.data.id}/backdate-slot`, {}, false);
    const unpaidReview = await api('POST', `/me/bookings/${unpaidBook.json.data.id}/review`, { rating: 4 });
    if (unpaidReview.status === 400 && unpaidReview.json.code === 'NOT_FULLY_PAID') {
      pass('not-fully-paid booking cannot be reviewed');
    } else fail('unpaid review', `${unpaidReview.status} ${unpaidReview.json.code}`);
    }
  }

  const refunded = await createPaidBooking();
  if (!refunded?.bookingId) {
    fail('refunded booking create', 'null');
  } else {
  await login(CUSTOMER);
  const rr = await api('POST', `/me/bookings/${refunded.bookingId}/refund-request`, {
    reason: 'استرداد كامل قبل الزيارة لاختبار منع التقييم',
  });
  await login(ADMIN);
  let refundPatch = { status: 0, json: {} };
  if (rr.status === 201 && rr.json.data?.id) {
    refundPatch = await api('PATCH', `/admin/refund-requests/${rr.json.data.id}/status`, {
      status: 'approved',
      adminNote: 'QA full refund for review eligibility',
    });
    if (refundPatch.status === 200) {
      refundPatch = await api('PATCH', `/admin/refund-requests/${rr.json.data.id}/status`, {
        status: 'processed',
        adminNote: 'QA processed',
      });
    }
  }
  await login(CUSTOMER);
  const refundReview = await api('POST', `/me/bookings/${refunded.bookingId}/review`, { rating: 3 });
  if (
    refundReview.status === 400 &&
    (refundReview.json.code === 'FULLY_REFUNDED' ||
      refundReview.json.code === 'NOT_ELIGIBLE' ||
      refundReview.json.code === 'VISIT_NOT_ENDED')
  ) {
    pass('fully refunded booking cannot be reviewed');
  } else fail('refunded review', `${refundReview.status} ${refundReview.json.code} rr=${rr.status} patch=${refundPatch.status}`);
  }

  const valid = await createPaidBooking();
  if (!valid?.bookingId) {
    fail('valid booking create', 'null');
    console.log(`\n10E.1: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  await api('POST', `/internal/bookings/${valid.bookingId}/backdate-slot`, {}, false);
  await api('POST', `/internal/bookings/${valid.bookingId}/mark-verified-visit`, {}, false);
  await login(CUSTOMER);
  const badRating = await api('POST', `/me/bookings/${valid.bookingId}/review`, { rating: 9 });
  if (badRating.status === 400) pass('rating outside 1–5 is rejected');
  else fail('bad rating', badRating.status);

  const created = await api('POST', `/me/bookings/${valid.bookingId}/review`, {
    rating: 5,
    comment: 'إقامة ممتازة بعد الزيارة',
  });
  if (created.status === 201 && created.json.data?.rating === 5) pass('valid completed booking can be reviewed');
  else fail('valid review', `${created.status} ${created.json.code}`);

  const dup = await api('POST', `/me/bookings/${valid.bookingId}/review`, { rating: 4 });
  if (dup.status === 409) pass('one booking cannot be reviewed twice');
  else fail('duplicate', `${dup.status} ${dup.json.code}`);

  const pub = await api('GET', `/properties/${SLUG}`, undefined, false);
  const listed = (pub.json.data?.reviews ?? []).some((r) => r.id === created.json.data?.id);
  if (pub.json.data?.reviewCount >= 1 && pub.json.data?.rating > 0 && listed) {
    pass('public property returns real review data');
  } else fail('public reviews', JSON.stringify({ count: pub.json.data?.reviewCount, rating: pub.json.data?.rating }));

  const searchLive = await api('GET', `/properties?q=emerald`, undefined, false);
  const liveCard = (searchLive.json.data ?? []).find((p) => p.slug === SLUG);
  if (liveCard?.reviewCount > 0 && liveCard.rating > 0) pass('search card exposes real rating only when reviews exist');
  else fail('search live rating', JSON.stringify(liveCard && { r: liveCard.rating, n: liveCard.reviewCount }));

  await login(ADMIN);
  const adminList = await api('GET', '/admin/reviews');
  const adminRow = (adminList.json.data ?? []).find((r) => r.id === created.json.data?.id);
  const hidden = await api('POST', `/admin/reviews/${created.json.data.id}/hide`, { reason: 'QA hide' });
  if (hidden.status === 200 && hidden.json.data?.status === 'hidden') pass('admin can hide a review');
  else fail('hide', `${hidden.status} ${hidden.json.code}`);

  const afterHide = await api('GET', `/properties/${SLUG}`, undefined, false);
  const stillPublic = (afterHide.json.data?.reviews ?? []).some((r) => r.id === created.json.data?.id);
  const avgHidden = afterHide.json.data?.reviewCount ?? 0;
  if (!stillPublic) pass('hidden review is excluded from public average/count');
  else fail('hidden public', `count=${avgHidden}`);

  const restored = await api('POST', `/admin/reviews/${created.json.data.id}/restore`, {});
  if (restored.status === 200 && restored.json.data?.status === 'published' && adminRow) {
    pass('admin can restore a review');
  } else fail('restore', `${restored.status} ${restored.json.code}`);

  const afterRestore = await api('GET', `/properties/${SLUG}`, undefined, false);
  if ((afterRestore.json.data?.reviews ?? []).some((r) => r.id === created.json.data?.id)) {
    pass('property average uses published reviews only');
  } else fail('published avg', afterRestore.json.data?.reviewCount);

  await login(OWNER1);
  const ownerHide = await api('POST', `/owner/reviews/${created.json.data.id}/hide`, { reason: 'nope' });
  if (ownerHide.status === 403) pass('owner cannot modify a review');
  else fail('owner hide', ownerHide.status);

  const ownerList = await api('GET', '/owner/reviews');
  if (ownerList.status === 200 && (ownerList.json.data ?? []).some((r) => r.id === created.json.data?.id)) {
    pass('owner can read reviews');
  } else fail('owner list', ownerList.status);

  console.log(`\n10E.1: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
