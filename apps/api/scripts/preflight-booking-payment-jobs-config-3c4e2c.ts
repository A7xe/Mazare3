/**
 * Phase 3C.4E.2C — Production config readiness (no secrets printed).
 * Run: pnpm preflight:booking-payment-jobs-config
 */
import { runBookingPaymentJobsConfigPreflight } from '../src/services/booking-payment-jobs-preflight.service.js';

async function main() {
  const report = runBookingPaymentJobsConfigPreflight();
  console.log(JSON.stringify(report, null, 2));
  if (report.secretsPrinted !== false) {
    console.error('ERROR: secrets must not be printed');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
