/**
 * AF-1.1b READ-ONLY property field audit. No writes.
 * Run from packages/db: pnpm exec tsx ./scripts/af11b-readonly-property-audit.ts
 * (loads ../../.env via load-env)
 */
import '../prisma/load-env.js';
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function main() {
  const appEnv = process.env.APP_ENV ?? '(unset)';
  console.log(`APP_ENV=${appEnv}`);
  if (appEnv === 'production') {
    console.error('Refusing to query: APP_ENV=production');
    process.exit(2);
  }

  const total = await prisma.property.count();
  const byStatus = await prisma.property.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const emptyCity = await prisma.property.count({ where: { city: '' } });
  const emptyArea = await prisma.property.count({ where: { area: '' } });
  const emptyApprox = await prisma.property.count({ where: { approximateAddress: '' } });
  const zeroOrNegPrice = await prisma.property.count({
    where: { basePrice: { lte: 0 } },
  });
  const whitespaceCity = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM "Property" WHERE TRIM("city") = ''`,
  );
  const whitespaceArea = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM "Property" WHERE TRIM("area") = ''`,
  );
  const whitespaceApprox = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM "Property" WHERE TRIM("approximateAddress") = ''`,
  );

  console.log(
    JSON.stringify(
      {
        totalProperties: total,
        statusDistribution: Object.fromEntries(
          byStatus.map((r) => [r.status, r._count._all]),
        ),
        emptyCity,
        emptyArea,
        emptyApproximateAddress: emptyApprox,
        zeroOrNegativeBasePrice: zeroOrNegPrice,
        whitespaceOnlyCity: Number(whitespaceCity[0]?.c ?? 0),
        whitespaceOnlyArea: Number(whitespaceArea[0]?.c ?? 0),
        whitespaceOnlyApproximateAddress: Number(whitespaceApprox[0]?.c ?? 0),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
