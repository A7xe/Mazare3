/**
 * Phase 3C.4E.2C — Read-only Booking/payment jobs preflight.
 * Run: pnpm preflight:booking-payment-jobs
 */
import { runBookingPaymentJobsPreflightReport } from '../src/services/booking-payment-jobs-preflight.service.js';

async function main() {
  const report = await runBookingPaymentJobsPreflightReport();
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
