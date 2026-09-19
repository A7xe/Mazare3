/**
 * Phase 3C.4D.7A — Read-only payout beneficiary preflight.
 * Run: pnpm preflight:payout-beneficiary
 */
import { runPayoutBeneficiaryPreflightReport } from '../src/services/payout-beneficiary.service.js';

async function main() {
  const report = await runPayoutBeneficiaryPreflightReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.mutation !== false) {
    console.error('ERROR: preflight claimed mutation');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
