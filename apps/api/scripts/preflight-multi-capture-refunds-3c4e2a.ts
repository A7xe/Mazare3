/**
 * Phase 3C.4E.2A — Read-only multi-capture refund preflight.
 * Run: pnpm preflight:multi-capture-refunds
 */
import { runMultiCaptureRefundPreflightReport } from '../src/services/multi-capture-refund-preflight.service.js';

async function main() {
  const report = await runMultiCaptureRefundPreflightReport();
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
