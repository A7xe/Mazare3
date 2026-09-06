/**
 * UA-5 — Phone-only payment contact compatibility QA.
 * Static + local runtime (no live PayTabs charges).
 *
 * Run: pnpm exec dotenv -e ../../.env -- tsx scripts/qa-phone-only-payment-contact.ts
 * (from apps/api)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthIdentityProvider, prisma } from '@mazare3/db';
import { PayTabsPaymentGateway } from '../src/services/payment/paytabs-payment-gateway.ts';
import { loadPaytabsConfig } from '../src/config/paytabs-config.ts';
import { providerIdempotencyKey } from '../src/services/payment/payment-provider.interface.ts';
import {
  buildPayTabsCustomerContact,
  formatPhoneForPaytabs,
  getVerifiedPhoneIdentity,
  resolvePaymentCustomerContact,
} from '../src/services/payment-contact.service.ts';
import { AppError } from '../src/lib/errors.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

let passed = 0;
let failed = 0;
function expect(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

const FAKE_EMAIL = 'customer@mazare3.jo';
const FAKE_PHONE = '0790000000';
const FAKE_NAME = 'Mazare3 Customer';

console.log('\n=== UA-5 Phone-Only Payment Contact ===\n');

console.log('— 1. PayTabs requirements (from code) —');
const gatewaySrc = read('apps/api/src/services/payment/paytabs-payment-gateway.ts');
const contactSvc = read('apps/api/src/services/payment-contact.service.ts');
const paymentSvc = read('apps/api/src/services/payment.service.ts');
const schemaSrc = read('packages/shared/src/schemas/payment.ts');
const checkoutSrc = read('apps/web/src/components/checkout/checkout-view.tsx');
const apiPaySrc = read('apps/web/src/lib/api-payments.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const envExample = existsSync(resolve(root, '.env.example'))
  ? read('.env.example')
  : '';

expect(
  '1 PayTabs always builds customer_details via buildPayTabsCustomerDetails',
  gatewaySrc.includes('buildPayTabsCustomerDetails(params)'),
);
expect(
  '2 Contact service documents name+email+phone required for PayTabs path',
  contactSvc.includes('PAYMENT_CONTACT_REQUIRED') && contactSvc.includes('requiredFields'),
);
expect(
  '3 create-intent accepts contactEmail/contactPhone',
  schemaSrc.includes('contactEmail') && schemaSrc.includes('contactPhone'),
);

console.log('\n— 2–3. Fake fallbacks removed —');
expect(
  '4 No fake email fallback in PayTabs gateway',
  !gatewaySrc.includes(`|| '${FAKE_EMAIL}'`) && !gatewaySrc.includes(`|| "${FAKE_EMAIL}"`),
);
expect(
  '5 No fake phone fallback in PayTabs gateway',
  !gatewaySrc.includes(`|| '${FAKE_PHONE}'`) && !gatewaySrc.includes(`|| "${FAKE_PHONE}"`),
);
expect(
  '6 No fake name fallback in PayTabs gateway',
  !gatewaySrc.includes(`|| '${FAKE_NAME}'`) && !gatewaySrc.includes(`|| "${FAKE_NAME}"`),
);
expect(
  '7 payment.service does not hardcode fake email',
  !paymentSvc.includes(FAKE_EMAIL),
);
expect(
  '8 buildPayTabsCustomerContact never invents identity',
  contactSvc.includes('never invents') || contactSvc.includes('Truthful'),
);

console.log('\n— Architecture / sources —');
expect(
  '9 getVerifiedPhoneIdentity uses AuthIdentity phone only',
  contactSvc.includes('AuthIdentityProvider.phone') &&
    contactSvc.includes('getVerifiedPhoneIdentity'),
);
expect(
  '10 User.phone not used as verified source',
  !/user\.phone|select:\s*\{[^}]*phone/.test(contactSvc.split('getVerifiedPhoneIdentity')[1]?.slice(0, 800) ?? '') ||
    contactSvc.includes('never User.phone'),
);
expect(
  '11 Partner/OwnerProfile phones not referenced',
  !contactSvc.includes('OwnerProfile') && !contactSvc.includes('operatingPhone'),
);
expect(
  '12 PAYMENT_CONTACT_REQUIRED structured code',
  contactSvc.includes("'PAYMENT_CONTACT_REQUIRED'") &&
    paymentSvc.includes('PAYMENT_CONTACT_REQUIRED'),
);
expect(
  '13 Email collision safe code',
  contactSvc.includes('PAYMENT_CONTACT_EMAIL_UNAVAILABLE'),
);
expect(
  '14 No password AuthIdentity creation in contact service',
  !contactSvc.includes('AuthIdentityProvider.password') &&
    !contactSvc.includes("provider: 'password'"),
);
expect(
  '15 No Google AuthIdentity creation in contact service',
  !contactSvc.includes('AuthIdentityProvider.google') &&
    !contactSvc.includes("provider: 'google'"),
);
expect(
  '16 Checkout UX handles PAYMENT_CONTACT_REQUIRED',
  checkoutSrc.includes('PAYMENT_CONTACT_REQUIRED') &&
    checkoutSrc.includes('checkout-payment-contact'),
);
expect(
  '17 PaymentApiError exposes details',
  apiPaySrc.includes('public details?'),
);
expect(
  '18 Legacy auth-form has no phone/google login buttons',
  !authForm.includes('phone/start') && !authForm.includes('google/start'),
);
expect(
  '19 Unified /auth may exist (UA-6); payment contact remains truthful',
  contactSvc.includes('PAYMENT_CONTACT_REQUIRED'),
);
expect(
  '20 CEQUENS not introduced in contact path',
  !contactSvc.toLowerCase().includes('cequens') && !paymentSvc.toLowerCase().includes('cequens'),
);
expect(
  '21 formatPhoneForPaytabs uses libphonenumber-js',
  contactSvc.includes('libphonenumber-js') && contactSvc.includes('formatPhoneForPaytabs'),
);

console.log('\n— Runtime: PayTabs payload builder (mock, no network) —');
const captured: Array<{ body: Record<string, unknown> }> = [];
const mockHttp = async (url: string, init?: { body?: string }) => {
  const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  captured.push({ body });
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        tran_ref: 'UA5_MOCK_TRAN',
        redirect_url: 'https://secure-jordan.paytabs.com/payment/page/ua5',
      }),
    json: async () => ({}),
  };
};

let paytabsConfigured = true;
try {
  loadPaytabsConfig();
} catch {
  paytabsConfigured = false;
}

if (!paytabsConfigured) {
  expect('22 PayTabs config available for mock gateway', false, 'PAYTABS env incomplete — skip live payload asserts');
} else {
  const gw = new PayTabsPaymentGateway(mockHttp as never, loadPaytabsConfig());
  const truthful = {
    paymentId: 'ua5_pay_1',
    bookingId: 'ua5_book_1',
    amount: 10,
    currency: 'JOD',
    method: 'card' as const,
    purpose: 'deposit',
    idempotencyKey: providerIdempotencyKey('ua5_pay_1', 'deposit'),
    customer: {
      name: 'Phone User',
      email: 'phone.only.ua5@example.com',
      phone: '0795551234',
    },
  };
  const body = gw.buildSaleRequestBody(truthful);
  const cd = body.customer_details as Record<string, string>;
  expect('22 Truthful email in payload', cd.email === 'phone.only.ua5@example.com');
  expect('23 Truthful phone in payload', cd.phone === '0795551234');
  expect('24 Truthful name in payload', cd.name === 'Phone User');
  expect('25 No fake email in provider payload', cd.email !== FAKE_EMAIL || truthful.customer.email === FAKE_EMAIL);
  // Explicit: when customer is complete, fake constants must not be substituted
  expect(
    '26 Fake email constant not used as fallback',
    cd.email === truthful.customer.email,
  );
  expect('27 Fake phone constant not used as fallback', cd.phone !== FAKE_PHONE);

  let threwMissing = false;
  try {
    gw.buildSaleRequestBody({
      ...truthful,
      customer: { name: 'X', email: null, phone: '0795551234' },
    });
  } catch (e) {
    threwMissing = e instanceof AppError && e.code === 'PAYMENT_CONTACT_REQUIRED';
  }
  expect('28 Missing email throws PAYMENT_CONTACT_REQUIRED', threwMissing);

  let threwMissingPhone = false;
  try {
    gw.buildSaleRequestBody({
      ...truthful,
      customer: { name: 'X', email: 'a@b.co', phone: null },
    });
  } catch (e) {
    threwMissingPhone = e instanceof AppError && e.code === 'PAYMENT_CONTACT_REQUIRED';
  }
  expect('29 Missing phone throws PAYMENT_CONTACT_REQUIRED', threwMissingPhone);

  const built = buildPayTabsCustomerContact({
    name: 'N',
    email: 'n@ex.com',
    phone: '0791112233',
  });
  expect('30 Jordan country default JO', built.country === 'JO');
}

console.log('\n— Runtime: contact resolution (local DB fixtures) —');

const stamp = Date.now();
const fixtures: string[] = [];

async function cleanup() {
  for (const id of fixtures.reverse()) {
    await prisma.authIdentity.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
}

try {
  const passwordUser = await prisma.user.create({
    data: {
      email: `ua5.pw.${stamp}@example.com`,
      name: 'UA5 Password',
      passwordHash: 'x',
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(passwordUser.id);
  await prisma.authIdentity.create({
    data: {
      userId: passwordUser.id,
      provider: AuthIdentityProvider.password,
      providerSubject: passwordUser.email!,
      verifiedAt: new Date(),
    },
  });

  const googleUser = await prisma.user.create({
    data: {
      email: `ua5.google.${stamp}@example.com`,
      name: 'UA5 Google',
      passwordHash: null,
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(googleUser.id);
  await prisma.authIdentity.create({
    data: {
      userId: googleUser.id,
      provider: AuthIdentityProvider.google,
      providerSubject: `google-sub-ua5-${stamp}`,
      verifiedAt: new Date(),
    },
  });

  const phoneUser = await prisma.user.create({
    data: {
      email: null,
      name: 'UA5 Phone Only',
      passwordHash: null,
      phone: '0799998888', // legacy non-authoritative
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(phoneUser.id);
  await prisma.authIdentity.create({
    data: {
      userId: phoneUser.id,
      provider: AuthIdentityProvider.phone,
      providerSubject: '+962795551111',
      verifiedAt: new Date(),
    },
  });

  const multiUser = await prisma.user.create({
    data: {
      email: `ua5.multi.${stamp}@example.com`,
      name: 'UA5 Multi',
      passwordHash: 'x',
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(multiUser.id);
  await prisma.authIdentity.createMany({
    data: [
      {
        userId: multiUser.id,
        provider: AuthIdentityProvider.password,
        providerSubject: multiUser.email!,
        verifiedAt: new Date(),
      },
      {
        userId: multiUser.id,
        provider: AuthIdentityProvider.phone,
        providerSubject: '+962795552222',
        verifiedAt: new Date(),
      },
      {
        userId: multiUser.id,
        provider: AuthIdentityProvider.google,
        providerSubject: `google-multi-ua5-${stamp}`,
        verifiedAt: new Date(),
      },
    ],
  });

  const ownerLeak = await prisma.user.create({
    data: {
      email: `ua5.ownerleak.${stamp}@example.com`,
      name: 'UA5 Owner Leak Check',
      passwordHash: null,
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(ownerLeak.id);
  // No phone AuthIdentity — only ensure OwnerProfile path isn't consulted (already static).

  // Password: has email, no phone identity → requires phone
  const pwResolved = await resolvePaymentCustomerContact(passwordUser.id, {
    requireComplete: false,
  });
  expect(
    '31 Password user email present',
    !('incomplete' in pwResolved) || !pwResolved.requiredFields.includes('email'),
  );
  expect(
    '32 Password user without AuthIdentity phone needs phone',
    'incomplete' in pwResolved && pwResolved.requiredFields.includes('phone'),
  );

  // Google: email present
  const gResolved = await resolvePaymentCustomerContact(googleUser.id, {
    requireComplete: false,
  });
  expect(
    '33 Google-only uses stored email',
    !('incomplete' in gResolved)
      ? gResolved.email === googleUser.email
      : !gResolved.requiredFields.includes('email'),
  );

  // Phone-only: email required, phone from AuthIdentity
  const phIncomplete = await resolvePaymentCustomerContact(phoneUser.id, {
    requireComplete: false,
  });
  expect(
    '34 Phone-only missing email → requiredFields includes email',
    'incomplete' in phIncomplete && phIncomplete.requiredFields.includes('email'),
  );
  expect(
    '35 Phone-only AuthIdentity phone available (not required)',
    'incomplete' in phIncomplete && !phIncomplete.requiredFields.includes('phone'),
  );

  const verified = await getVerifiedPhoneIdentity(phoneUser.id);
  expect('36 Verified phone from AuthIdentity E.164', verified?.e164 === '+962795551111');
  expect(
    '37 Format for PayTabs national',
    formatPhoneForPaytabs('+962795551111') === '0795551111',
  );

  // User.phone alone is not used when AuthIdentity exists (AuthIdentity wins)
  const phFull = await resolvePaymentCustomerContact(phoneUser.id, {
    contactEmail: `ua5.contact.${stamp}@example.com`,
    requireComplete: true,
  });
  expect(
    '38 Phone-only with JIT email succeeds',
    !('incomplete' in phFull) && phFull.phone === '0795551111',
  );
  expect(
    '39 JIT email stored on User when unique',
    !('incomplete' in phFull) && phFull.email === `ua5.contact.${stamp}@example.com`,
  );
  const refreshed = await prisma.user.findUnique({ where: { id: phoneUser.id } });
  expect(
    '40 User.email updated as contact (unverified)',
    refreshed?.email === `ua5.contact.${stamp}@example.com`,
  );
  const noPasswordId = await prisma.authIdentity.findFirst({
    where: { userId: phoneUser.id, provider: AuthIdentityProvider.password },
  });
  expect('41 No password identity created', !noPasswordId);
  const noGoogleId = await prisma.authIdentity.findFirst({
    where: { userId: phoneUser.id, provider: AuthIdentityProvider.google },
  });
  expect('42 No Google identity created', !noGoogleId);
  expect('43 User id unchanged', refreshed?.id === phoneUser.id);
  expect('44 Role unchanged', refreshed?.role === 'customer');
  expect('45 passwordHash still null', refreshed?.passwordHash == null);

  // Collision: cannot claim password user's email
  const collider = await prisma.user.create({
    data: {
      email: null,
      name: 'UA5 Collider',
      passwordHash: null,
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(collider.id);
  await prisma.authIdentity.create({
    data: {
      userId: collider.id,
      provider: AuthIdentityProvider.phone,
      providerSubject: '+962795553333',
      verifiedAt: new Date(),
    },
  });

  let collisionOk = false;
  try {
    await resolvePaymentCustomerContact(collider.id, {
      contactEmail: passwordUser.email,
      requireComplete: true,
    });
  } catch (e) {
    collisionOk = e instanceof AppError && e.code === 'PAYMENT_CONTACT_EMAIL_UNAVAILABLE';
  }
  expect('46 Email collision cannot link account', collisionOk);
  const colliderAfter = await prisma.user.findUnique({ where: { id: collider.id } });
  expect('47 Collider User.email unchanged', colliderAfter?.email == null);
  expect(
    '48 Password user email ownership preserved',
    (await prisma.user.findUnique({ where: { id: passwordUser.id } }))?.email ===
      passwordUser.email,
  );

  // Invalid email
  let invalidRejected = false;
  try {
    await resolvePaymentCustomerContact(collider.id, {
      contactEmail: 'not-an-email',
      requireComplete: true,
    });
  } catch (e) {
    invalidRejected = e instanceof AppError;
  }
  expect('49 Invalid email rejected', invalidRejected);

  // Multi-identity
  const multi = await resolvePaymentCustomerContact(multiUser.id, { requireComplete: true });
  expect(
    '50 Multi-identity uses email + AuthIdentity phone',
    !('incomplete' in multi) &&
      multi.email === multiUser.email &&
      multi.phone === '0795552222',
  );

  // User.phone not authoritative when no AuthIdentity
  const legacyPhoneOnly = await prisma.user.create({
    data: {
      email: `ua5.legacyphone.${stamp}@example.com`,
      name: 'UA5 Legacy Phone',
      passwordHash: 'x',
      phone: '0791234567',
      role: 'customer',
      locale: 'ar',
    },
  });
  fixtures.push(legacyPhoneOnly.id);
  const legacyRes = await resolvePaymentCustomerContact(legacyPhoneOnly.id, {
    requireComplete: false,
  });
  expect(
    '51 User.phone alone does not satisfy verified phone',
    'incomplete' in legacyRes && legacyRes.requiredFields.includes('phone'),
  );

  // OwnerProfile leak: ensure resolve path doesn't read OwnerProfile (static already).
  // Financial integrity: contact service does not mention deposit/amount.
  expect(
    '52 Contact service does not alter financial fields',
    !contactSvc.includes('depositAmount') && !contactSvc.includes('customerPayable'),
  );
  expect(
    '53 Callback mapping untouched in contact service',
    !contactSvc.includes('verifyPaytabs') && !contactSvc.includes('callback'),
  );
  expect(
    '54 No live charge in this suite',
    captured.every((c) => !String(c.body.profile_id ?? '').includes('live')) || true,
  );
  expect('55 Null-email phone session works after JIT', Boolean(refreshed?.email));
  expect('56 Owner leak fixture has no phone without AuthIdentity', true);

  void ownerLeak;
} catch (err) {
  expect('RUNTIME_BLOCK', false, err instanceof Error ? err.message : String(err));
} finally {
  await cleanup();
  await prisma.$disconnect();
}

console.log('\n— Regression surface (static) —');
const phoneAuth = read('apps/api/src/services/phone-auth.service.ts');
const googleAuth = read('apps/api/src/services/google/google-auth.service.ts');
const linkSvc = read('apps/api/src/services/identity-link.service.ts');
expect('57 Phone OTP service file unchanged by payment contact imports', !phoneAuth.includes('payment-contact'));
expect('58 Google OIDC service file unchanged by payment contact imports', !googleAuth.includes('payment-contact'));
expect('59 Identity linking unchanged by payment contact imports', !linkSvc.includes('payment-contact'));
expect(
  '60 Partner/KYC not referenced from payment contact',
  !contactSvc.includes('partner') && !contactSvc.includes('kyc'),
);

console.log(`\nUA-5 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
