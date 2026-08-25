import './env.js';
import { getAppEnv } from './config/app-env.js';
import { loadPaymentConfig } from './config/payment-config.js';
import { getPaytabsSafeDiagnostics } from './config/paytabs-config.js';
import { validatePaymentProviderAtStartup } from './config/validate-payment-provider.js';
import { validatePartnerDocumentStorageAtStartup } from './config/partner-document-storage.config.js';
import {
  validatePropertyMediaStorageAtStartup,
  getPublicPropertyMediaSafeDiagnostics,
  loadPropertyMediaStorageProvider,
} from './config/property-media-storage.config.js';
import { describeCookiePolicy } from './lib/cookie-options.js';
import { createApp } from './app.js';

validatePaymentProviderAtStartup();
validatePartnerDocumentStorageAtStartup();
validatePropertyMediaStorageAtStartup();

const PORT = Number(process.env.API_PORT ?? 4000);

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
