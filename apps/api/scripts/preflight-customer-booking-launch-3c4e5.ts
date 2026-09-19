/**
 * Phase 3C.4E.5 — Customer Booking launch preflight (READ ONLY).
 * Run: pnpm preflight:customer-booking-launch
 */
import { runCustomerBookingLaunchPreflightReport } from '../src/services/customer-booking-launch-preflight.service.js';

async function main() {
  const report = await runCustomerBookingLaunchPreflightReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.mutation !== false) {
    console.error('ERROR: preflight claimed mutation');
    process.exit(2);
  }
  if (report.secretsPrinted !== false) {
    console.error('ERROR: secrets must not be printed');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
