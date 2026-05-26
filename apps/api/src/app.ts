import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { API_VERSION } from '@mazare3/shared';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { propertiesRouter } from './routes/properties.js';
import { authRouter } from './routes/auth.js';
import { bookingsRouter } from './routes/bookings.js';
import { meRouter } from './routes/me.js';
import { ownerRouter } from './routes/owner.js';
import { adminRouter } from './routes/admin.js';
import { paymentsRouter } from './routes/payments.js';
import { paymentsPublicRouter } from './routes/payments-public.js';
import { paymentWebhooksRouter } from './routes/payment-webhooks.js';
import { internalRouter } from './routes/internal.js';
import { isInternalQaRoutesEnabled } from './lib/qa-mode.js';

export function createApp(): Express {
  const app = express();

  const corsOrigin =
    process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  const api = `/api/${API_VERSION}`;
  app.use(api, healthRouter);
  app.use(`${api}/auth`, authRouter);
  app.use(`${api}/properties`, propertiesRouter);
  app.use(`${api}/bookings`, bookingsRouter);
  app.use(`${api}/me`, meRouter);
  app.use(`${api}/owner`, ownerRouter);
  app.use(`${api}/admin`, adminRouter);
  app.use(`${api}/payments/webhooks`, paymentWebhooksRouter);
  app.use(`${api}/payments`, paymentsPublicRouter);
  app.use(`${api}/payments`, paymentsRouter);
  if (isInternalQaRoutesEnabled()) {
    app.use(`${api}/internal`, internalRouter);
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  });

  app.use(errorHandler);

  return app;
}
