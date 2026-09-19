import './env.js';
import { getAppEnv } from './config/app-env.js';
import { loadPaymentConfig } from './config/payment-config.js';
import { getPaytabsSafeDiagnostics } from './config/paytabs-config.js';
import { validatePaymentProviderAtStartup } from './config/validate-payment-provider.js';
import { validateEmailProviderAtStartup } from './config/validate-email-provider.js';
import { validateSmsOtpProviderAtStartup } from './config/validate-sms-otp-provider.js';
import { validateGoogleAuthAtStartup } from './config/validate-google-auth.js';
import { validatePartnerDocumentStorageAtStartup } from './config/partner-document-storage.config.js';
import {
  validatePropertyMediaStorageAtStartup,
  getPublicPropertyMediaSafeDiagnostics,
  loadPropertyMediaStorageProvider,
} from './config/property-media-storage.config.js';
import { describeCookiePolicy } from './lib/cookie-options.js';
import { createApp } from './app.js';
import { assertProductionLegalReady } from './services/legal/legal-production-guard.js';

validatePaymentProviderAtStartup();
validateEmailProviderAtStartup();
validateSmsOtpProviderAtStartup();
validateGoogleAuthAtStartup();
validatePartnerDocumentStorageAtStartup();
validatePropertyMediaStorageAtStartup();

const PORT = Number(process.env.API_PORT ?? 4000);

async function start() {
  await assertProductionLegalReady();

  const app = createApp();

  app.listen(PORT, () => {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    console.log(
      `[api] Mazare3 API listening on http://localhost:${PORT} (NODE_ENV=${nodeEnv}, APP_ENV=${getAppEnv()})`,
    );
    console.log(`[api] ${describeCookiePolicy()}`);
    const payments = loadPaymentConfig();
    if (payments.provider === 'paytabs') {
      console.log('[api] paytabs', getPaytabsSafeDiagnostics());
    }
    if (loadPropertyMediaStorageProvider() === 'cloudflare_r2_public') {
      console.log('[api] public-media', getPublicPropertyMediaSafeDiagnostics());
    }
  });
}

start().catch((err) => {
  console.error('[api] startup failed:', err);
  process.exit(1);
});
