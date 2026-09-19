/**
 * Phase 3C.4E.4A — Read-only Customer legal-acceptance preflight.
 * Run: pnpm preflight:customer-legal-acceptance
 */
import { runCustomerLegalAcceptancePreflightReport } from '../src/services/legal/customer-legal-acceptance-preflight.service.js';

async function main() {
  const report = await runCustomerLegalAcceptancePreflightReport();
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
