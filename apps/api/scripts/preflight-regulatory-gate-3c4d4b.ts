/**
 * Phase 3C.4D.4B — Read-only regulatory gate preflight report.
 * Run: pnpm preflight:regulatory-gate
 *
 * Zero mutations. No private document contents or secrets.
 * Inspect before enabling the regulatory gate in Production.
 */
import { runRegulatoryGatePreflightReport } from '../src/services/property-bookability.service.js';

async function main() {
  const report = await runRegulatoryGatePreflightReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.mutation !== false) {
    console.error('ERROR: preflight claimed mutation — abort');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
