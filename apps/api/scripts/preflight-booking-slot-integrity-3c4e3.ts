/**
 * Phase 3C.4E.3 — Read-only Booking slot integrity preflight.
 * Run: pnpm preflight:booking-slot-integrity
 */
import { runBookingSlotIntegrityPreflightReport } from '../src/services/booking-slot-integrity-preflight.service.js';

async function main() {
  const report = await runBookingSlotIntegrityPreflightReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.mutation !== false) {
    console.error('ERROR: preflight claimed mutation');
    process.exit(2);
  }
  if (report.legacy.BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED) {
    console.error('WARN: active duplicate holding Bookings — migration will refuse until resolved');
    process.exit(3);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
