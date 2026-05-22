import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mazare3-api',
    timestamp: new Date().toISOString(),
  });
});
