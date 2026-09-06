/**
 * UA-1 — controlled null-email synthetic QA (LOCAL ONLY).
 * Run: node scripts/ua1-null-email-synthetic-qa.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(resolve(root, 'apps/api/package.json'));
const jwt = require('jsonwebtoken');

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

async function main() {
  const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (appEnv !== 'local' && appEnv !== 'test') {
    console.error('REFUSED: null-email QA only on local|test');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    console.error('REFUSED: JWT_SECRET/SESSION_SECRET required');
    process.exit(1);
  }

  const { PrismaClient, UserRole, UserStatus } = await import(
    '../packages/db/generated/client/index.js'
  );
  const prisma = new PrismaClient({ log: ['error'] });

  let passed = 0;
  let failed = 0;
  function expect(name, cond) {
    if (cond) {
      passed++;
      console.log(`  ✅ ${name}`);
    } else {
      failed++;
      console.log(`  ❌ ${name}`);
    }
  }

  console.log('\n— UA-1 null-email synthetic —\n');

  const marker = `ua1-null-${Date.now()}`;
  let userId = '';

  try {
    const user = await prisma.user.create({
      data: {
        name: marker,
        email: null,
        passwordHash: null,
        role: UserRole.customer,
        status: UserStatus.active,
        locale: 'ar',
      },
    });
    userId = user.id;

    expect('role customer', user.role === 'customer');
    expect('email null', user.email === null);
    expect('passwordHash null', user.passwordHash === null);

    const token = jwt.sign(
      { userId: user.id, email: null, role: 'customer', pwdAt: 0 },
      secret,
      { expiresIn: '1h' },
    );
    expect('session signs with null email', typeof token === 'string' && token.length > 20);

    const decoded = jwt.verify(token, secret);
    expect('JWT preserves null email claim', decoded.email === null && decoded.userId === user.id);

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    expect(
      'serializer-shaped select works',
      me != null && me.email === null && me.role === 'customer' && me.status === 'active',
    );

    const byFakeEmail = await prisma.user.findUnique({
      where: { email: `${marker}@example.com` },
    });
    expect('no password login target for fixture', byFakeEmail === null);

    const listed = await prisma.user.findMany({
      where: { id: user.id },
      select: { id: true, email: true, name: true, role: true },
    });
    expect('admin-style list does not crash', listed.length === 1 && listed[0].email === null);
  } finally {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
