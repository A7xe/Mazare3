/**
 * UA-3 — Google identity resolution runtime (LOCAL ONLY, no real Google network).
 *
 * Run:
 *   pnpm --filter @mazare3/api exec tsx ../../scripts/ua3-google-oidc-runtime.ts
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

const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
if (appEnv !== 'local' && appEnv !== 'test') {
  console.error('REFUSED: UA-3 runtime only on local|test');
  process.exit(1);
}

process.env.PRISMA_DISABLE_QUERY_LOG = process.env.PRISMA_DISABLE_QUERY_LOG || 'true';

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
  const { resolveGoogleIdentity, sanitizeGoogleDisplayName } = await import(
    '../apps/api/src/services/google/google-auth.service.ts'
  );
  const {
    signGoogleOAuthTransaction,
    verifyGoogleOAuthTransaction,
    generateOAuthState,
    generateOAuthNonce,
    generatePkceVerifier,
    pkceS256Challenge,
    timingSafeEqualString,
  } = await import('../apps/api/src/lib/google-oauth-transaction.ts');
  const { validateGoogleAuthAtStartup } = await import(
    '../apps/api/src/config/validate-google-auth.ts'
  );
  const { AppError } = await import('../apps/api/src/lib/errors.ts');
  const { loginUser } = await import('../apps/api/src/services/auth.service.ts');
  const { requestPasswordReset } = await import(
    '../apps/api/src/services/password-reset.service.ts'
  );
  const { sanitizeReturnUrl } = await import('../packages/shared/src/safe-return-url.ts');

  const stamp = Date.now();
  const cleanupIds: string[] = [];

  console.log('\n— UA-3 Google OIDC runtime —\n');

  try {
    // Name policy
    expect('name valid kept', sanitizeGoogleDisplayName('Sara Ahmad') === 'Sara Ahmad');
    expect('name empty → null', sanitizeGoogleDisplayName('  ') === null);
    expect('name no invent', sanitizeGoogleDisplayName('') === null);

    // Return URL
    expect('returnUrl internal ok', sanitizeReturnUrl('/ar/account') === '/ar/account');
    expect('returnUrl external rejected', sanitizeReturnUrl('https://evil.example') === null);
    expect('returnUrl protocol-relative rejected', sanitizeReturnUrl('//evil.example') === null);

    // OAuth transaction / state / pkce
    const state = generateOAuthState();
    const nonce = generateOAuthNonce();
    const verifier = generatePkceVerifier();
    const challenge = pkceS256Challenge(verifier);
    expect('pkce challenge differs from verifier', challenge !== verifier);
    const txToken = signGoogleOAuthTransaction({
      state,
      nonce,
      codeVerifier: verifier,
      returnUrl: '/ar/account',
    });
    const tx = verifyGoogleOAuthTransaction(txToken);
    expect('tx roundtrip state', timingSafeEqualString(tx.state, state));
    expect('tx roundtrip nonce', tx.nonce === nonce);
    expect('state mismatch detect', !timingSafeEqualString(state, generateOAuthState()));

    // Config: disabled by default does not throw at startup
    const prevEnabled = process.env.GOOGLE_AUTH_ENABLED;
    process.env.GOOGLE_AUTH_ENABLED = 'false';
    try {
      validateGoogleAuthAtStartup();
      expect('disabled config startup ok', true);
    } catch {
      expect('disabled config startup ok', false);
    }
    process.env.GOOGLE_AUTH_ENABLED = prevEnabled;

    // Production refusal simulation (function checks APP_ENV)
    // Covered in architecture; skip mutating APP_ENV here.

    // Scenario: new Google user
    const subNew = `ua3-sub-new-${stamp}`;
    const emailNew = `ua3.google.new.${stamp}@example.com`;
    const rNew = await resolveGoogleIdentity({
      sub: subNew,
      email: emailNew,
      emailVerified: true,
      name: 'UA3 Google New',
    });
    expect('new → authenticated', rNew.outcome === 'authenticated');
    if (rNew.outcome === 'authenticated') {
      cleanupIds.push(rNew.session.userId);
      expect('new customer', rNew.user.role === 'customer');
      expect('new email set', rNew.user.email === emailNew.toLowerCase());
      const dbUser = await prisma.user.findUnique({ where: { id: rNew.session.userId } });
      expect('new passwordHash null', dbUser?.passwordHash == null);
      const id = await prisma.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: AuthIdentityProvider.google,
            providerSubject: subNew,
          },
        },
      });
      expect('new google identity verifiedAt', Boolean(id?.verifiedAt));
      const pwdId = await prisma.authIdentity.count({
        where: { userId: rNew.session.userId, provider: AuthIdentityProvider.password },
      });
      expect('new no password identity', pwdId === 0);
    }

    // Existing Google sub → same user
    const rAgain = await resolveGoogleIdentity({
      sub: subNew,
      email: `changed.${emailNew}`,
      emailVerified: true,
      name: 'Changed Name',
    });
    expect('existing sub authenticated', rAgain.outcome === 'authenticated');
    if (rNew.outcome === 'authenticated' && rAgain.outcome === 'authenticated') {
      expect('same userId by sub', rAgain.session.userId === rNew.session.userId);
      const unchanged = await prisma.user.findUnique({ where: { id: rNew.session.userId } });
      expect('email not silently mutated', unchanged?.email === emailNew.toLowerCase());
    }

    // Unverified email
    let unverifiedFail = false;
    try {
      await resolveGoogleIdentity({
        sub: `ua3-sub-unv-${stamp}`,
        email: `ua3.unv.${stamp}@example.com`,
        emailVerified: false,
        name: 'X',
      });
    } catch (err) {
      unverifiedFail = err instanceof AppError && err.code === 'GOOGLE_EMAIL_UNVERIFIED';
    }
    expect('unverified email rejected', unverifiedFail);

    // Missing email (new)
    let missingFail = false;
    try {
      await resolveGoogleIdentity({
        sub: `ua3-sub-noemail-${stamp}`,
        email: null,
        emailVerified: false,
        name: null,
      });
    } catch (err) {
      missingFail = err instanceof AppError && err.code === 'GOOGLE_EMAIL_REQUIRED';
    }
    expect('missing email rejected for new', missingFail);

    // Email collision — password user
    const collideEmail = `ua3.collide.${stamp}@example.com`;
    const passUser = await prisma.user.create({
      data: {
        name: 'UA3 Password Collide',
        email: collideEmail,
        passwordHash: 'not-a-real-hash-but-present',
        role: UserRole.customer,
        status: UserStatus.active,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.password,
            providerSubject: collideEmail,
            verifiedAt: null,
          },
        },
      },
    });
    cleanupIds.push(passUser.id);
    const beforeHash = passUser.passwordHash;
    const rCollide = await resolveGoogleIdentity({
      sub: `ua3-sub-collide-${stamp}`,
      email: collideEmail,
      emailVerified: true,
      name: 'Google Collide',
    });
    expect('collision → link required', rCollide.outcome === 'existing_account_link_required');
    const googleOnPass = await prisma.authIdentity.count({
      where: { userId: passUser.id, provider: AuthIdentityProvider.google },
    });
    expect('collision no google identity', googleOnPass === 0);
    const after = await prisma.user.findUnique({ where: { id: passUser.id } });
    expect('collision password unchanged', after?.passwordHash === beforeHash);

    // Owner collision
    const ownerEmail = `ua3.owner.${stamp}@example.com`;
    const ownerUser = await prisma.user.create({
      data: {
        name: 'UA3 Owner Collide',
        email: ownerEmail,
        passwordHash: 'x',
        role: UserRole.owner,
        status: UserStatus.active,
      },
    });
    cleanupIds.push(ownerUser.id);
    const rOwner = await resolveGoogleIdentity({
      sub: `ua3-sub-owner-${stamp}`,
      email: ownerEmail,
      emailVerified: true,
      name: 'G',
    });
    expect('owner collision → link required', rOwner.outcome === 'existing_account_link_required');

    // Admin collision
    const adminEmail = `ua3.admin.${stamp}@example.com`;
    const adminUser = await prisma.user.create({
      data: {
        name: 'UA3 Admin Collide',
        email: adminEmail,
        passwordHash: 'x',
        role: UserRole.admin,
        status: UserStatus.active,
      },
    });
    cleanupIds.push(adminUser.id);
    const rAdmin = await resolveGoogleIdentity({
      sub: `ua3-sub-admin-${stamp}`,
      email: adminEmail,
      emailVerified: true,
      name: 'G',
    });
    expect(
      'admin → privileged blocked',
      rAdmin.outcome === 'provider_not_allowed_for_privileged_account',
    );
    const adminGoogle = await prisma.authIdentity.count({
      where: { userId: adminUser.id, provider: AuthIdentityProvider.google },
    });
    expect('admin no google identity', adminGoogle === 0);

    // Suspended
    const susSub = `ua3-sub-sus-${stamp}`;
    const susUser = await prisma.user.create({
      data: {
        name: 'UA3 Sus',
        email: `ua3.sus.${stamp}@example.com`,
        passwordHash: null,
        role: UserRole.customer,
        status: UserStatus.suspended,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.google,
            providerSubject: susSub,
            verifiedAt: new Date(),
          },
        },
      },
    });
    cleanupIds.push(susUser.id);
    let susBlocked = false;
    try {
      await resolveGoogleIdentity({
        sub: susSub,
        email: `ua3.sus.${stamp}@example.com`,
        emailVerified: true,
        name: 'S',
      });
    } catch (err) {
      susBlocked = err instanceof AppError && err.code === 'ACCOUNT_SUSPENDED';
    }
    expect('suspended blocked', susBlocked);

    // Deleted
    const delSub = `ua3-sub-del-${stamp}`;
    const delUser = await prisma.user.create({
      data: {
        name: 'UA3 Del',
        email: `ua3.del.${stamp}@example.com`,
        passwordHash: null,
        role: UserRole.customer,
        status: UserStatus.deleted,
        authIdentities: {
          create: {
            provider: AuthIdentityProvider.google,
            providerSubject: delSub,
            verifiedAt: new Date(),
          },
        },
      },
    });
    cleanupIds.push(delUser.id);
    let delBlocked = false;
    try {
      await resolveGoogleIdentity({
        sub: delSub,
        email: `ua3.del.${stamp}@example.com`,
        emailVerified: true,
        name: 'D',
      });
    } catch (err) {
      delBlocked = err instanceof AppError && err.code === 'ACCOUNT_SUSPENDED';
    }
    expect('deleted blocked', delBlocked);

    // Concurrent create same sub
    const concSub = `ua3-sub-conc-${stamp}`;
    const concEmail = `ua3.conc.${stamp}@example.com`;
    const concResults = await Promise.allSettled([
      resolveGoogleIdentity({
        sub: concSub,
        email: concEmail,
        emailVerified: true,
        name: 'Conc A',
      }),
      resolveGoogleIdentity({
        sub: concSub,
        email: concEmail,
        emailVerified: true,
        name: 'Conc B',
      }),
    ]);
    const concOk = concResults.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<
      Awaited<ReturnType<typeof resolveGoogleIdentity>>
    >[];
    const authOk = concOk.filter((r) => r.value.outcome === 'authenticated');
    expect('concurrent ≥1 success', authOk.length >= 1);
    const idCount = await prisma.authIdentity.count({
      where: { provider: AuthIdentityProvider.google, providerSubject: concSub },
    });
    expect('concurrent one google identity', idCount === 1);
    const userCount = await prisma.user.count({ where: { email: concEmail } });
    expect('concurrent one user email', userCount === 1);
    if (authOk[0]) cleanupIds.push(authOk[0].value.session.userId);

    // Google-only password login / reset
    if (rNew.outcome === 'authenticated' && rNew.user.email) {
      let loginFail = false;
      try {
        await loginUser({ email: rNew.user.email, password: 'Whatever123!' });
      } catch (err) {
        loginFail = err instanceof AppError && err.code === 'INVALID_CREDENTIALS';
      }
      expect('google-only password login generic', loginFail);
      const reset = await requestPasswordReset({ email: rNew.user.email });
      expect('google-only forgot generic', Boolean(reset.message));
      // No token issued for null passwordHash — check via PasswordResetToken count
      const tokens = await prisma.passwordResetToken.count({
        where: { userId: rNew.session.userId },
      });
      expect('google-only no reset token', tokens === 0);
    }

    // OAuth tx replay: verifying twice is ok for JWT, but cookie clear is the consume.
    // Ensure expired/invalid typ fails
    let badTx = false;
    try {
      verifyGoogleOAuthTransaction('not-a-jwt');
    } catch (err) {
      badTx = err instanceof AppError && err.code === 'INVALID_OAUTH_STATE';
    }
    expect('invalid oauth tx rejected', badTx);
  } finally {
    for (const id of cleanupIds) {
      await prisma.authIdentity.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.passwordResetToken.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }

  console.log(`\n📊 UA-3 runtime: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
