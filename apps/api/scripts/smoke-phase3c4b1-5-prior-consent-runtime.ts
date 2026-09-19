/**
 * Phase 3C.4B.1.5 — local runtime smoke for DataProcessingConsent.
 * Run from API package: pnpm smoke:phase3c4b1-5-prior-consent
 */
import {
  DataProcessingConsentPurpose,
  DataProcessingConsentStatus,
  prisma,
} from '@mazare3/db';

async function main() {
  const tables = await prisma.$queryRaw<Array<{ t: string | null }>>`
    SELECT to_regclass('public."DataProcessingConsent"')::text AS t
  `;
  if (!tables[0]?.t) {
    throw new Error('DataProcessingConsent table missing — migration not applied');
  }
  console.log('OK table exists:', tables[0].t);

  const user = await prisma.user.findFirst({
    where: { status: 'active' },
    select: { id: true },
  });
  if (!user) {
    console.log('SMOKE_SKIP: no active user for grant/withdraw round-trip');
    return;
  }

  await prisma.dataProcessingConsent.deleteMany({
    where: { userId: user.id, sourceSurface: 'phase3c4b1-5-smoke' },
  });

  const created = await prisma.dataProcessingConsent.create({
    data: {
      userId: user.id,
      purposeKey: DataProcessingConsentPurpose.account_registration_and_authentication,
      purposeVersion: '3c4b1-5-smoke',
      language: 'en',
      consentText: 'smoke consent text — temporary',
      consentTextHash: 'b'.repeat(64),
      status: DataProcessingConsentStatus.granted,
      durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
      sourceSurface: 'phase3c4b1-5-smoke',
    },
  });

  const withdrawn = await prisma.dataProcessingConsent.update({
    where: { id: created.id },
    data: {
      status: DataProcessingConsentStatus.withdrawn,
      withdrawnAt: new Date(),
    },
  });

  if (withdrawn.status !== 'withdrawn' || !withdrawn.withdrawnAt) {
    throw new Error('withdraw smoke failed');
  }

  const stillThere = await prisma.dataProcessingConsent.findUnique({
    where: { id: created.id },
  });
  if (!stillThere) throw new Error('withdrawal erased history');

  await prisma.dataProcessingConsent.delete({ where: { id: created.id } });
  console.log('SMOKE_OK grant/withdraw/history', {
    userId: user.id.slice(0, 8),
    id: created.id.slice(0, 8),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
