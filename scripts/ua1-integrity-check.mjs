import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, AuthIdentityProvider } from '../packages/db/generated/client/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

const p = new PrismaClient({ log: ['error'] });
const users = await p.user.count();
const eligible = await p.user.count({
  where: { email: { not: null }, passwordHash: { not: null } },
});
const pw = await p.authIdentity.count({ where: { provider: AuthIdentityProvider.password } });
const phone = await p.authIdentity.count({ where: { provider: AuthIdentityProvider.phone } });
const google = await p.authIdentity.count({ where: { provider: AuthIdentityProvider.google } });
const verified = await p.authIdentity.count({
  where: { provider: AuthIdentityProvider.password, verifiedAt: { not: null } },
});
const multi = await p.$queryRaw`
  SELECT "providerSubject", COUNT(*)::int AS c
  FROM "AuthIdentity"
  WHERE provider = 'password'
  GROUP BY 1
  HAVING COUNT(*) > 1
`;
console.log(
  JSON.stringify(
    {
      users,
      eligiblePasswordUsers: eligible,
      passwordIdentities: pw,
      phone,
      google,
      passwordVerifiedAtSet: verified,
      duplicatePasswordSubjects: Array.isArray(multi) ? multi.length : 0,
      match: pw === eligible,
    },
    null,
    2,
  ),
);
await p.$disconnect();
