/**
 * UA-4 — Identity linking runtime (LOCAL ONLY; memory SMS; mocked Google identity objects).
 * Run: pnpm --filter @mazare3/api exec tsx ../../scripts/ua4-identity-linking-runtime.ts
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnv();
process.env.SMS_OTP_PROVIDER = 'memory';
process.env.PHONE_OTP_RESEND_COOLDOWN_MS = process.env.PHONE_OTP_RESEND_COOLDOWN_MS || '1';
process.env.PRISMA_DISABLE_QUERY_LOG = 'true';

const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
if (appEnv !== 'local' && appEnv !== 'test') {
  console.error('REFUSED: UA-4 runtime only on local|test');
  process.exit(1);
}

let passed = 0;
let failed = 0;
function expect(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

async function main() {
  const { AuthIdentityProvider, UserRole, UserStatus, prisma } = await import(
    '../packages/db/src/index.ts'
  );
  const { resetSmsOtpProviderCacheForQa } = await import(
    '../apps/api/src/services/sms/get-sms-otp-provider.ts'
  );
  const { clearMemorySmsOtpOutbox, getLastMemorySmsOtpForPhone } = await import(
    '../apps/api/src/services/sms/memory-sms-otp-provider.ts'
  );
  const { startPhoneOtp, verifyPhoneOtp, startPhoneLinkOtp, verifyPhoneLinkOtp } = await import(
    '../apps/api/src/services/phone-auth.service.ts'
  );
  const { resolveGoogleIdentity } = await import(
    '../apps/api/src/services/google/google-auth.service.ts'
  );
  const { completeIdentityLink, linkProviderToAuthenticatedUser } = await import(
    '../apps/api/src/services/identity-link.service.ts'
  );
  const {
    clearConsumedIdentityLinkIntentsForQa,
    signIdentityLinkIntent,
    verifyIdentityLinkIntent,
  } = await import('../apps/api/src/lib/identity-link-intent.ts');
  const { signGoogleOAuthTransaction, verifyGoogleOAuthTransaction } = await import(
    '../apps/api/src/lib/google-oauth-transaction.ts'
  );
  const { normalizeJordanPhoneE164 } = await import('../apps/api/src/lib/phone-normalize.ts');
  const { AppError } = await import('../apps/api/src/lib/errors.ts');

  resetSmsOtpProviderCacheForQa();
  clearMemorySmsOtpOutbox();
  clearConsumedIdentityLinkIntentsForQa();

  const stamp = Date.now();
  const cleanupIds: string[] = [];

  console.log('\n— UA-4 identity linking runtime —\n');

  try {
    // A — Google collision → link
    const emailA = `ua4.a.${stamp}@example.com`;
    const hashA = await bcrypt.hash('Mazare3Test2026!', 10);
    const userA = await prisma.user.create({
      data: {
        name: 'UA4 A',
        email: emailA,
        passwordHash: hashA,
        role: UserRole.customer,
        status: UserStatus.active,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.password,
            providerSubject: emailA,
            verifiedAt: null,
          },
        },
      },
    });
    cleanupIds.push(userA.id);
    const subA = `ua4-g-sub-a-${stamp}`;
    const rA = await resolveGoogleIdentity({
      sub: subA,
      email: emailA,
      emailVerified: true,
      name: 'G A',
    });
    expect('A LINK_REQUIRED', rA.outcome === 'existing_account_link_required');
    if (rA.outcome !== 'existing_account_link_required') throw new Error('A expected link');
    const linkedA = await completeIdentityLink({
      authenticatedUserId: userA.id,
      linkIntentToken: rA.linkToken,
    });
    expect('A linked', linkedA.outcome === 'linked' || linkedA.outcome === 'already_linked');
    const gCountA = await prisma.authIdentity.count({
      where: { userId: userA.id, provider: AuthIdentityProvider.google },
    });
    expect('A google identity', gCountA === 1);
    const afterHash = (await prisma.user.findUnique({ where: { id: userA.id } }))?.passwordHash;
    expect('A password unchanged', afterHash === hashA);

    // B — wrong account
    const userB = await prisma.user.create({
      data: {
        name: 'UA4 B',
        email: `ua4.b.${stamp}@example.com`,
        passwordHash: 'x',
        role: UserRole.customer,
        status: UserStatus.active,
      },
    });
    cleanupIds.push(userB.id);
    const subB = `ua4-g-sub-b-${stamp}`;
    const emailBTarget = emailA; // collide with A again — use different sub
    // Create fresh collision intent for userA with new sub
    const rBIntent = await resolveGoogleIdentity({
      sub: subB,
      email: emailA,
      emailVerified: true,
      name: 'G B',
    });
    expect('B intent for A', rBIntent.outcome === 'existing_account_link_required');
    let mismatch = false;
    if (rBIntent.outcome === 'existing_account_link_required') {
      try {
        await completeIdentityLink({
          authenticatedUserId: userB.id,
          linkIntentToken: rBIntent.linkToken,
        });
      } catch (err) {
        mismatch = err instanceof AppError && err.code === 'IDENTITY_LINK_ACCOUNT_MISMATCH';
      }
    }
    expect('B wrong account mismatch', mismatch);
    const gOnB = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.google, providerSubject: subB },
    });
    expect('B no identity created', gOnB === 0);

    // C — legacy phone collision
    const phoneC = `079${String(stamp).slice(-7)}`;
    const e164C = normalizeJordanPhoneE164(phoneC);
    const userC = await prisma.user.create({
      data: {
        name: 'UA4 C',
        email: `ua4.c.${stamp}@example.com`,
        passwordHash: 'x',
        phone: phoneC,
        role: UserRole.customer,
        status: UserStatus.active,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.password,
            providerSubject: `ua4.c.${stamp}@example.com`,
            verifiedAt: null,
          },
        },
      },
    });
    cleanupIds.push(userC.id);
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const startC = await startPhoneOtp({ phone: phoneC });
    const otpC = getLastMemorySmsOtpForPhone(e164C)!;
    const vC = await verifyPhoneOtp({
      challengeId: startC.challengeId,
      phone: phoneC,
      code: otpC.code,
    });
    expect('C LINK_REQUIRED', vC.outcome === 'existing_account_link_required');
    if (vC.outcome === 'existing_account_link_required') {
      const linkC = await completeIdentityLink({
        authenticatedUserId: userC.id,
        linkIntentToken: vC.linkToken,
      });
      expect('C linked phone', linkC.outcome === 'linked' || linkC.outcome === 'already_linked');
    }
    const phoneIdC = await prisma.authIdentity.count({
      where: { userId: userC.id, provider: AuthIdentityProvider.phone },
    });
    expect('C phone identity', phoneIdC === 1);

    // D — proactive phone link
    const phoneD = `078${String(stamp).slice(-7)}`;
    const e164D = normalizeJordanPhoneE164(phoneD);
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const startD = await startPhoneLinkOtp({ authenticatedUserId: userA.id, phone: phoneD });
    const otpD = getLastMemorySmsOtpForPhone(e164D)!;
    const linkD = await verifyPhoneLinkOtp({
      authenticatedUserId: userA.id,
      challengeId: startD.challengeId,
      phone: phoneD,
      code: otpD.code,
    });
    expect('D proactive phone linked', linkD.outcome === 'linked' || linkD.outcome === 'already_linked');

    // E — proactive Google link (direct attach, no OAuth network)
    const subE = `ua4-g-proactive-${stamp}`;
    const linkE = await linkProviderToAuthenticatedUser({
      authenticatedUserId: userA.id,
      provider: 'google',
      providerSubject: subE,
      verifiedEmail: `ua4.proactive.${stamp}@example.com`,
      emailVerified: true,
    });
    // userA already has google from A — this is a different sub, should link second google? 
    // AuthIdentity uniqueness is per provider+subject, so multiple google subs on same user are allowed by schema.
    // But product-wise one User can have one google identity typically - schema allows multiple different subjects.
    expect('E proactive google', linkE.outcome === 'linked' || linkE.outcome === 'already_linked');

    // F — phone-first + Google
    const phoneF = `077${String(stamp + 1).slice(-7)}`;
    const e164F = normalizeJordanPhoneE164(phoneF);
    const userF = await prisma.user.create({
      data: {
        name: 'UA4 PhoneFirst',
        email: null,
        passwordHash: null,
        role: UserRole.customer,
        status: UserStatus.active,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.phone,
            providerSubject: e164F,
            verifiedAt: new Date(),
          },
        },
      },
    });
    cleanupIds.push(userF.id);
    const gEmailF = `ua4.phonefirst.${stamp}@example.com`;
    const linkF = await linkProviderToAuthenticatedUser({
      authenticatedUserId: userF.id,
      provider: 'google',
      providerSubject: `ua4-g-pf-${stamp}`,
      verifiedEmail: gEmailF,
      emailVerified: true,
    });
    expect('F linked google', linkF.outcome === 'linked');
    const userFAfter = await prisma.user.findUnique({ where: { id: userF.id } });
    expect('F email populated', userFAfter?.email === gEmailF.toLowerCase());

    // G — Google-first + phone
    const userG = await prisma.user.create({
      data: {
        name: 'UA4 GoogleFirst',
        email: `ua4.gf.${stamp}@example.com`,
        passwordHash: null,
        role: UserRole.customer,
        status: UserStatus.active,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.google,
            providerSubject: `ua4-g-gf-${stamp}`,
            verifiedAt: new Date(),
          },
        },
      },
    });
    cleanupIds.push(userG.id);
    const phoneG = `076${String(stamp + 2).slice(-7)}`;
    const e164G = normalizeJordanPhoneE164(phoneG);
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const startG = await startPhoneLinkOtp({ authenticatedUserId: userG.id, phone: phoneG });
    const otpG = getLastMemorySmsOtpForPhone(e164G)!;
    const linkG = await verifyPhoneLinkOtp({
      authenticatedUserId: userG.id,
      challengeId: startG.challengeId,
      phone: phoneG,
      code: otpG.code,
    });
    expect('G phone linked', linkG.outcome === 'linked');
    expect('G still no password', (await prisma.user.findUnique({ where: { id: userG.id } }))?.passwordHash == null);

    // H — triple: userA should have password + phone + google
    const idsA = await prisma.authIdentity.findMany({
      where: { userId: userA.id },
      select: { provider: true },
    });
    const providersA = new Set(idsA.map((i) => i.provider));
    expect('H has password', providersA.has(AuthIdentityProvider.password));
    expect('H has phone', providersA.has(AuthIdentityProvider.phone));
    expect('H has google', providersA.has(AuthIdentityProvider.google));

    // I — provider owned elsewhere
    let owned = false;
    try {
      await linkProviderToAuthenticatedUser({
        authenticatedUserId: userB.id,
        provider: 'phone',
        providerSubject: e164D, // owned by userA
      });
    } catch (err) {
      owned = err instanceof AppError && err.code === 'IDENTITY_ALREADY_LINKED';
    }
    expect('I already linked elsewhere', owned);

    // J — replay
    let replay = false;
    try {
      await completeIdentityLink({
        authenticatedUserId: userA.id,
        linkIntentToken: rA.linkToken,
      });
    } catch (err) {
      replay =
        err instanceof AppError &&
        (err.code === 'IDENTITY_LINK_INTENT_USED' || err.code === 'ALREADY_LINKED' || err.code === 'IDENTITY_ALREADY_LINKED');
      // After consume, jti marked — or already_linked from completeIdentityLink
      if (!replay && err instanceof AppError) {
        // completeIdentityLink may return already_linked without throw if identity exists
        replay = false;
      }
    }
    // Prefer: consumed jti throws USED; if somehow still valid, already_linked outcome
    if (!replay) {
      try {
        const again = await completeIdentityLink({
          authenticatedUserId: userA.id,
          linkIntentToken: rA.linkToken,
        });
        replay = again.outcome === 'already_linked';
      } catch (err) {
        replay =
          err instanceof AppError &&
          (err.code === 'IDENTITY_LINK_INTENT_USED' || err.code === 'INVALID_LINK_INTENT');
      }
    }
    expect('J replay safe', replay);

    // Purpose separation: auth_continue challenge cannot verify as link_phone
    const phoneP = `075${String(stamp + 3).slice(-7)}`;
    const e164P = normalizeJordanPhoneE164(phoneP);
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const startP = await startPhoneOtp({ phone: phoneP });
    const otpP = getLastMemorySmsOtpForPhone(e164P)!;
    let purposeFail = false;
    try {
      await verifyPhoneLinkOtp({
        authenticatedUserId: userA.id,
        challengeId: startP.challengeId,
        phone: phoneP,
        code: otpP.code,
      });
    } catch (err) {
      purposeFail = err instanceof AppError && err.code === 'INVALID_OTP';
    }
    expect('purpose auth≠link', purposeFail);

    // Google mode separation
    const txAuth = signGoogleOAuthTransaction({
      state: 's1',
      nonce: 'n1',
      codeVerifier: 'v1'.padEnd(43, 'a'),
      returnUrl: null,
      mode: 'authenticate',
    });
    const txLink = signGoogleOAuthTransaction({
      state: 's2',
      nonce: 'n2',
      codeVerifier: 'v2'.padEnd(43, 'b'),
      returnUrl: null,
      mode: 'link',
      linkUserId: userA.id,
    });
    expect('mode authenticate', verifyGoogleOAuthTransaction(txAuth).mode === 'authenticate');
    expect('mode link', verifyGoogleOAuthTransaction(txLink).mode === 'link');
    expect('mode link has user', verifyGoogleOAuthTransaction(txLink).linkUserId === userA.id);

    // Admin denied
    const admin = await prisma.user.create({
      data: {
        name: 'UA4 Admin',
        email: `ua4.admin.${stamp}@example.com`,
        passwordHash: 'x',
        role: UserRole.admin,
        status: UserStatus.active,
      },
    });
    cleanupIds.push(admin.id);
    let adminDenied = false;
    try {
      await linkProviderToAuthenticatedUser({
        authenticatedUserId: admin.id,
        provider: 'google',
        providerSubject: `ua4-admin-g-${stamp}`,
        verifiedEmail: `ua4.admin.g.${stamp}@example.com`,
        emailVerified: true,
      });
    } catch (err) {
      adminDenied =
        err instanceof AppError && err.code === 'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT';
    }
    expect('admin cannot link', adminDenied);

    // Concurrent complete
    const { token: concToken } = signIdentityLinkIntent({
      provider: 'google',
      providerSubject: `ua4-conc-${stamp}`,
      intendedUserId: userB.id,
      verifiedEmail: `ua4.conc.${stamp}@example.com`,
      verifiedAt: Date.now(),
    });
    const conc = await Promise.allSettled([
      completeIdentityLink({ authenticatedUserId: userB.id, linkIntentToken: concToken }),
      completeIdentityLink({ authenticatedUserId: userB.id, linkIntentToken: concToken }),
    ]);
    const concOk = conc.filter((c) => c.status === 'fulfilled').length;
    const concIds = await prisma.authIdentity.count({
      where: {
        provider: AuthIdentityProvider.google,
        providerSubject: `ua4-conc-${stamp}`,
      },
    });
    expect('concurrent ≥1 success', concOk >= 1);
    expect('concurrent one identity', concIds === 1);

    // Intent expiry type
    const intent = verifyIdentityLinkIntent(concToken);
    expect('intent typ', intent.typ === 'identity_link');
  } finally {
    for (const id of cleanupIds) {
      await prisma.authIdentity.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.passwordResetToken.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    clearConsumedIdentityLinkIntentsForQa();
    await prisma.$disconnect();
  }

  console.log(`\n📊 UA-4 runtime: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
