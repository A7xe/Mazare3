/**
 * Phase 3C.4D.5 — Read-only pool/safety preflight.
 * Run: pnpm preflight:pool-safety
 */
import { runPoolSafetyPreflightReport } from '../src/services/property-pool-safety.service.js';

async function main() {
  const report = await runPoolSafetyPreflightReport();
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
