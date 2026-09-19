import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { API_VERSION } from '@mazare3/shared';
import { resolve } from 'path';
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
import { opsJobsRouter } from './routes/ops-jobs.js';
import { supportRouter } from './routes/support.js';
import { legalRouter } from './routes/legal.js';
import { adminLegalRouter } from './routes/admin-legal.js';
import { isInternalQaRoutesEnabled } from './lib/qa-mode.js';

export function createApp(): Express {
  const app = express();

  const corsOrigin =
    process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const corsOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

  if (corsOrigins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN must not be "*" when credentials are enabled. Set explicit frontend URL(s).',
    );
  }

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  const api = `/api/${API_VERSION}`;

  // PayTabs IPN HMAC is over the exact raw body bytes. Capture them before
  // express.json() consumes the stream. This path is public; auth is cryptographic.
  app.use(
    `${api}/payments/webhooks`,
    express.raw({ type: '*/*', limit: '1mb' }),
    (req, _res, next) => {
      const buf = req.body;
      if (Buffer.isBuffer(buf)) {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
        const text = buf.toString('utf8');
        try {
          req.body = text ? JSON.parse(text) : {};
        } catch {
          req.body = {};
        }
      }
      next();
    },
  );

  app.use(express.json());
  app.use(cookieParser());

  // Local-dev / Phase 8A: serve uploaded property media files
  app.use(
    '/uploads/property-media',
    express.static(resolve(process.cwd(), 'uploads', 'property-media')),
  );

  app.use(api, healthRouter);
  app.use(`${api}/auth`, authRouter);
  app.use(`${api}/properties`, propertiesRouter);
  app.use(`${api}/bookings`, bookingsRouter);
  app.use(`${api}/me`, meRouter);
  app.use(`${api}/support`, supportRouter);
  app.use(`${api}/legal`, legalRouter);
  app.use(`${api}/owner`, ownerRouter);
  app.use(`${api}/admin/legal`, adminLegalRouter);
  app.use(`${api}/admin`, adminRouter);
  app.use(`${api}/payments/webhooks`, paymentWebhooksRouter);
  app.use(`${api}/payments`, paymentsPublicRouter);
  app.use(`${api}/payments`, paymentsRouter);
  // Phase 3C.4E.2C — always mounted; mutating routes require INTERNAL_JOB_SECRET.
  app.use(`${api}/ops`, opsJobsRouter);
  if (isInternalQaRoutesEnabled()) {
    app.use(`${api}/internal`, internalRouter);
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  });

  app.use(errorHandler);

  return app;
}
