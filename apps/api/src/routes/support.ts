import { Router } from 'express';
import { createGeneralSupportTicketSchema } from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  optionalAttachUser,
  optionalAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { supportRateLimiter } from '../middleware/rate-limit.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import { createGeneralSupportTicket } from '../services/support.service.js';

export const supportRouter = Router();

supportRouter.post(
  '/contact',
  supportRateLimiter,
  optionalAuth,
  optionalAttachUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createGeneralSupportTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const actor = req.user
      ? { userId: req.user.id, name: req.user.name, email: req.user.email }
      : null;
    const data = await createGeneralSupportTicket(parsed.data, actor, req);
    res.status(201).json({ data });
  }),
);
