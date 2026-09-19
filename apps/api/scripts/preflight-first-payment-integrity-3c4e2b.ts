/**
 * Phase 3C.4E.2B — Read-only first-payment integrity preflight.
 * Run: pnpm preflight:first-payment-integrity
 */
import { runFirstPaymentIntegrityPreflightReport } from '../src/services/first-payment-integrity-preflight.service.js';

async function main() {
  const report = await runFirstPaymentIntegrityPreflightReport();
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
