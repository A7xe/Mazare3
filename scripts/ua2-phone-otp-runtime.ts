/**
 * UA-2 — Phone OTP runtime E2E (LOCAL ONLY, SMS_OTP_PROVIDER=memory).
 * Run:
 *   $env:SMS_OTP_PROVIDER='memory'; pnpm --filter @mazare3/api exec tsx ../../scripts/ua2-phone-otp-runtime.ts
 *
 * Does not print OTP codes in summary.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
if (appEnv !== 'local' && appEnv !== 'test') {
  console.error('REFUSED: UA-2 runtime only on local|test');
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
  const { startPhoneOtp, verifyPhoneOtp, completePhoneProfile } = await import(
    '../apps/api/src/services/phone-auth.service.ts'
  );
  const { normalizeJordanPhoneE164 } = await import('../apps/api/src/lib/phone-normalize.ts');
  const { AppError } = await import('../apps/api/src/lib/errors.ts');

  resetSmsOtpProviderCacheForQa();
  clearMemorySmsOtpOutbox();

  const stamp = Date.now();
  const phoneA = `079${String(stamp).slice(-7)}`;
  const phoneB = `078${String(stamp).slice(-7)}`;
  const e164A = normalizeJordanPhoneE164(phoneA);
  const e164B = normalizeJordanPhoneE164(phoneB);

  const cleanupIds: string[] = [];

  console.log('\n— UA-2 phone OTP runtime —\n');

  try {
    // Scenario A — new phone → profile → complete
    const startA = await startPhoneOtp({ phone: phoneA, locale: 'ar' });
    expect('A start returns challengeId', Boolean(startA.challengeId));
    const otpA1 = getLastMemorySmsOtpForPhone(e164A);
    expect('A memory OTP captured', Boolean(otpA1?.code));
    const verifyA = await verifyPhoneOtp({
      challengeId: startA.challengeId,
      phone: phoneA,
      code: otpA1!.code,
    });
    expect('A PROFILE_REQUIRED', verifyA.outcome === 'profile_required');
    if (verifyA.outcome !== 'profile_required') throw new Error('expected profile_required');
    const completeA = await completePhoneProfile({
      continueToken: verifyA.continueToken,
      phone: phoneA,
      name: `UA2 User ${stamp}`,
      locale: 'ar',
    });
    expect('A authenticated', completeA.outcome === 'authenticated');
    expect('A customer role', completeA.user.role === 'customer');
    expect('A email null', completeA.user.email === null);
    cleanupIds.push(completeA.session.userId);

    const idA = await prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: { provider: AuthIdentityProvider.phone, providerSubject: e164A },
      },
    });
    expect('A phone identity verifiedAt set', Boolean(idA?.verifiedAt));
    const userA = await prisma.user.findUnique({ where: { id: completeA.session.userId } });
    expect('A passwordHash null', userA?.passwordHash == null);

    // Replay complete
    let replayRejected = false;
    try {
      await completePhoneProfile({
        continueToken: verifyA.continueToken,
        phone: phoneA,
        name: `UA2 Replay ${stamp}`,
      });
    } catch (err) {
      replayRejected = err instanceof AppError && err.code === 'CONTINUE_TOKEN_USED';
    }
    expect('G continuation replay rejected', replayRejected);
    const usersWithPhone = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.phone, providerSubject: e164A },
    });
    expect('G still one identity', usersWithPhone === 1);

    // Scenario B — existing phone login
    clearMemorySmsOtpOutbox();
    const startB = await startPhoneOtp({ phone: phoneA, locale: 'ar' });
    // bypass cooldown by updating lastSentAt if needed — cooldown set to 1ms via env
    const otpB = getLastMemorySmsOtpForPhone(e164A);
    const verifyB = await verifyPhoneOtp({
      challengeId: startB.challengeId,
      phone: phoneA,
      code: otpB!.code,
    });
    expect('B existing login authenticated', verifyB.outcome === 'authenticated');
    if (verifyB.outcome === 'authenticated') {
      expect('B same userId', verifyB.session.userId === completeA.session.userId);
    }

    // Scenario C — wrong OTP exhaust
    clearMemorySmsOtpOutbox();
    // force cooldown pass
    await new Promise((r) => setTimeout(r, 5));
    const startC = await startPhoneOtp({ phone: phoneB, locale: 'ar' });
    const otpC = getLastMemorySmsOtpForPhone(e164B);
    let exhausted = false;
    for (let i = 0; i < 5; i++) {
      try {
        await verifyPhoneOtp({
          challengeId: startC.challengeId,
          phone: phoneB,
          code: '000000',
        });
      } catch (err) {
        if (err instanceof AppError && err.code === 'OTP_ATTEMPTS_EXCEEDED') exhausted = true;
      }
    }
    expect('C attempts exhausted', exhausted);
    let afterExhaust = false;
    try {
      await verifyPhoneOtp({
        challengeId: startC.challengeId,
        phone: phoneB,
        code: otpC!.code,
      });
    } catch {
      afterExhaust = true;
    }
    expect('C correct code after exhaust fails', afterExhaust);

    // Scenario D — single use
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const phoneD = `077${String(stamp + 1).slice(-7)}`;
    const e164D = normalizeJordanPhoneE164(phoneD);
    const startD = await startPhoneOtp({ phone: phoneD });
    const otpD = getLastMemorySmsOtpForPhone(e164D)!;
    const v1 = await verifyPhoneOtp({
      challengeId: startD.challengeId,
      phone: phoneD,
      code: otpD.code,
    });
    expect('D first verify ok', v1.outcome === 'profile_required' || v1.outcome === 'authenticated');
    let reuseFail = false;
    try {
      await verifyPhoneOtp({
        challengeId: startD.challengeId,
        phone: phoneD,
        code: otpD.code,
      });
    } catch {
      reuseFail = true;
    }
    expect('D OTP reuse rejected', reuseFail);

    // Scenario E — replacement
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const phoneE = `076${String(stamp + 2).slice(-7)}`;
    const e164E = normalizeJordanPhoneE164(phoneE);
    const startE1 = await startPhoneOtp({ phone: phoneE });
    const otpE1 = getLastMemorySmsOtpForPhone(e164E)!;
    await new Promise((r) => setTimeout(r, 5));
    const startE2 = await startPhoneOtp({ phone: phoneE });
    const otpE2 = getLastMemorySmsOtpForPhone(e164E)!;
    let oldFail = false;
    try {
      await verifyPhoneOtp({
        challengeId: startE1.challengeId,
        phone: phoneE,
        code: otpE1.code,
      });
    } catch {
      oldFail = true;
    }
    expect('E old challenge invalid', oldFail);
    const vE2 = await verifyPhoneOtp({
      challengeId: startE2.challengeId,
      phone: phoneE,
      code: otpE2.code,
    });
    expect('E new challenge valid', vE2.outcome === 'profile_required');

    // Scenario I — suspended
    const susPhone = `075${String(stamp + 3).slice(-7)}`;
    const susE164 = normalizeJordanPhoneE164(susPhone);
    const susUser = await prisma.user.create({
      data: {
        name: `UA2 Suspended ${stamp}`,
        email: null,
        passwordHash: null,
        role: UserRole.customer,
        status: UserStatus.suspended,
        locale: 'ar',
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.phone,
            providerSubject: susE164,
            verifiedAt: new Date(),
          },
        },
      },
    });
    cleanupIds.push(susUser.id);
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const startS = await startPhoneOtp({ phone: susPhone });
    const otpS = getLastMemorySmsOtpForPhone(susE164)!;
    let susBlocked = false;
    try {
      await verifyPhoneOtp({
        challengeId: startS.challengeId,
        phone: susPhone,
        code: otpS.code,
      });
    } catch (err) {
      susBlocked = err instanceof AppError && err.code === 'ACCOUNT_SUSPENDED';
    }
    expect('I suspended not authenticated', susBlocked);

    // Scenario H — concurrent complete
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const phoneH = `074${String(stamp + 4).slice(-7)}`;
    const e164H = normalizeJordanPhoneE164(phoneH);
    const startH = await startPhoneOtp({ phone: phoneH });
    const otpH = getLastMemorySmsOtpForPhone(e164H)!;
    const vH = await verifyPhoneOtp({
      challengeId: startH.challengeId,
      phone: phoneH,
      code: otpH.code,
    });
    expect('H profile required', vH.outcome === 'profile_required');
    if (vH.outcome !== 'profile_required') throw new Error('H expected profile');
    const results = await Promise.allSettled([
      completePhoneProfile({
        continueToken: vH.continueToken,
        phone: phoneH,
        name: `UA2 Conc A ${stamp}`,
      }),
      completePhoneProfile({
        continueToken: vH.continueToken,
        phone: phoneH,
        name: `UA2 Conc B ${stamp}`,
      }),
    ]);
    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    const identityCount = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.phone, providerSubject: e164H },
    });
    expect('H at most one success', okCount === 1);
    expect('H one phone identity', identityCount === 1);
    if (okCount === 1 && results[0]?.status === 'fulfilled') {
      cleanupIds.push(results[0].value.session.userId);
    } else if (okCount === 1 && results[1]?.status === 'fulfilled') {
      cleanupIds.push(results[1].value.session.userId);
    }

    // Legacy User.phone does not authenticate
    const legacyPhone = `073${String(stamp + 5).slice(-7)}`;
    const legacyE164 = normalizeJordanPhoneE164(legacyPhone);
    const legacyUser = await prisma.user.create({
      data: {
        name: `UA2 LegacyPhone ${stamp}`,
        email: `ua2-legacy-${stamp}@example.com`,
        passwordHash: 'not-a-real-hash',
        phone: legacyPhone,
        role: UserRole.customer,
        status: UserStatus.active,
      },
    });
    cleanupIds.push(legacyUser.id);
    clearMemorySmsOtpOutbox();
    await new Promise((r) => setTimeout(r, 5));
    const startL = await startPhoneOtp({ phone: legacyPhone });
    const otpL = getLastMemorySmsOtpForPhone(legacyE164)!;
    const vL = await verifyPhoneOtp({
      challengeId: startL.challengeId,
      phone: legacyPhone,
      code: otpL.code,
    });
    expect(
      'legacy User.phone → link required (no auto auth)',
      vL.outcome === 'existing_account_link_required',
    );
  } finally {
    for (const id of cleanupIds) {
      await prisma.authIdentity.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    clearMemorySmsOtpOutbox();
    await prisma.$disconnect();
  }

  console.log(`\n📊 UA-2 runtime: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
