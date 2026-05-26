import rateLimit from 'express-rate-limit';
import { isAuthRateLimitDisabled } from '../lib/qa-mode.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  message: {
    error: 'Too many attempts. Please try again later.',
    code: 'RATE_LIMITED',
  },
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
});
