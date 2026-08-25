/**
 * Startup guard probe for payment gateway misconfiguration (Phase 10G.1 QA).
 * Exit 0 + prints OK when validation passes; exit 2 + ERR:message when it throws.
 */
import { validatePaymentProviderAtStartup } from '../apps/api/src/config/validate-payment-provider.ts';

try {
  validatePaymentProviderAtStartup();
  console.log('OK');
} catch (e) {
  console.log(`ERR:${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}
