/**
 * Phase 3C.4D.6 — Read-only Booking listing snapshot preflight.
 * Run: pnpm preflight:booking-listing-snapshot
 */
import { runBookingListingSnapshotPreflightReport } from '../src/services/booking-listing-snapshot.service.js';

async function main() {
  const report = await runBookingListingSnapshotPreflightReport();
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
