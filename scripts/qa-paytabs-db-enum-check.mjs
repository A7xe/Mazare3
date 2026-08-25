import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../packages/db/generated/client/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(root, '.env'), 'utf8');
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (k && process.env[k] == null) process.env[k] = v;
}

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'PaymentProvider' ORDER BY e.enumsortorder`,
  );
  const labels = rows.map((r) => r.enumlabel);
  console.log(
    JSON.stringify(
      {
        paymentProviderEnums: labels,
        paytabsInDb: labels.includes('paytabs'),
        migrationNote:
          'No packages/db migration adds paytabs yet; schema.prisma includes it. Additive ALTER TYPE needed before live provider writes.',
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.log(
    JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
      paytabsInDb: false,
    }),
  );
} finally {
  await prisma.$disconnect();
}
