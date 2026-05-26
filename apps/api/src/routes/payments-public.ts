import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { getPublicPaymentConfig } from '../services/payment.service.js';

export const paymentsPublicRouter = Router();

paymentsPublicRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({ data: getPublicPaymentConfig() });
  }),
);
