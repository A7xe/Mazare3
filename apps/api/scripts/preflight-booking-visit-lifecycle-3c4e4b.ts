/**
 * Phase 3C.4E.4B — Read-only visit lifecycle preflight.
 * Run: pnpm preflight:booking-visit-lifecycle
 */
import { runBookingVisitLifecyclePreflightReport } from '../src/services/booking-visit-lifecycle-preflight.service.js';

async function main() {
  const report = await runBookingVisitLifecyclePreflightReport();
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
