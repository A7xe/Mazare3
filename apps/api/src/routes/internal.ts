import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { AppError } from '../lib/errors.js';
import { isInternalQaRoutesEnabled } from '../lib/qa-mode.js';
import {
  backdateBookingHoldForQa,
  backdateBalanceDueForQa,
  backdatePaymentExpiryForQa,
  expireStalePayments,
} from '../services/payment.service.js';
import {
  qaBackdateBookingSlot,
  qaBackdatePayoutEligible,
  qaEnsureAvailableSlot,
  qaBackdateBookingCreatedAt,
  qaSetPayoutAvailableAt,
} from '../services/internal-qa.service.js';
import {
  backdateOwnerApprovalDeadlineForQa,
  expireStaleOwnerApprovals,
} from '../services/owner-approval-expiry.service.js';
import {
  generateAvailabilityForProperty,
  generateAvailabilityForPublishedWithRules,
} from '../services/availability-generation.service.js';
import { generateDueOwnerSettlements } from '../services/owner-settlement.service.js';
import { reconcilePayTabsPayment } from '../services/paytabs-reconciliation.service.js';
import type { PaytabsQueryOverride } from '../services/paytabs-reconciliation.service.js';
import {
  isBackgroundJobName,
  listBackgroundJobNames,
  runBackgroundJob,
  runDueBackgroundJobs,
} from '../services/background-jobs.service.js';

export const internalRouter = Router();

function requireInternalQa() {
  if (!isInternalQaRoutesEnabled()) {
    throw new AppError(403, 'FORBIDDEN', 'Internal QA routes are disabled');
  }
}

internalRouter.post(
  '/payments/expire-stale',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    const result = await expireStalePayments();
    res.json({ data: result });
  }),
);

internalRouter.post(
  '/bookings/expire-owner-approvals',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    const result = await expireStaleOwnerApprovals();
    res.json({ data: result });
  }),
);

internalRouter.post(
  '/bookings/:id/backdate-owner-approval',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'booking id required', code: 'VALIDATION_ERROR' });
      return;
    }
    await backdateOwnerApprovalDeadlineForQa(id);
    res.json({ data: { ok: true } });
  }),
);

internalRouter.post(
  '/bookings/:id/backdate-created-at',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'booking id required', code: 'VALIDATION_ERROR' });
      return;
    }
    const daysAgo = Number((req.body as { daysAgo?: number })?.daysAgo ?? 40);
    const data = await qaBackdateBookingCreatedAt(id, daysAgo);
    res.json({ data });
  }),
);

internalRouter.post(
  '/bookings/:id/backdate-slot',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    const date = (req.body as { date?: string })?.date;
    if (!id) {
      res.status(400).json({ error: 'booking id required', code: 'VALIDATION_ERROR' });
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaBackdateBookingSlot(id, date);
    res.json({ data });
  }),
);

internalRouter.post(
  '/payments/:id/backdate-payout-eligible',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaBackdatePayoutEligible(id);
    res.json({ data });
  }),
);

internalRouter.post(
  '/payments/:id/set-payout-available-at',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const hoursFromNow = Number((req.body as { hoursFromNow?: number })?.hoursFromNow ?? 48);
    const data = await qaSetPayoutAvailableAt(id, hoursFromNow);
    res.json({ data });
  }),
);

internalRouter.post(
  '/bookings/:id/backdate-hold',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'booking id required', code: 'VALIDATION_ERROR' });
      return;
    }
    await backdateBookingHoldForQa(id);
    res.json({ data: { ok: true } });
  }),
);

internalRouter.post(
  '/bookings/:id/backdate-balance-due',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'booking id required', code: 'VALIDATION_ERROR' });
      return;
    }
    await backdateBalanceDueForQa(id);
    res.json({ data: { ok: true } });
  }),
);

internalRouter.post(
  '/properties/:slug/ensure-available-slot',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'slug required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaEnsureAvailableSlot(slug);
    res.json({ data });
  }),
);

internalRouter.post(
  '/payments/:id/backdate-expiry',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    await backdatePaymentExpiryForQa(id);
    res.json({ data: { ok: true } });
  }),
);

internalRouter.post(
  '/availability/generate',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const propertyId = (req.body as { propertyId?: string })?.propertyId;
    if (propertyId) {
      const data = await generateAvailabilityForProperty(propertyId);
      res.json({ data });
      return;
    }
    const data = await generateAvailabilityForPublishedWithRules();
    res.json({ data });
  }),
);

internalRouter.post(
  '/payments/:id/reconcile',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const body = (req.body ?? {}) as { query?: PaytabsQueryOverride };
    const query = body.query;
    if (query && !['pending', 'succeeded', 'failed'].includes(query.status)) {
      res.status(400).json({ error: 'Invalid query stub status', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await reconcilePayTabsPayment(id, {
      source: 'internal_qa',
      queryOverride: query,
    });
    res.json({ data });
  }),
);

internalRouter.post(
  '/settlements/generate-due',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as { asOf?: string; cycleDays?: number; ownerId?: string };
    const data = await generateDueOwnerSettlements({
      asOf: typeof body.asOf === 'string' ? body.asOf : undefined,
      cycleDays: typeof body.cycleDays === 'number' ? body.cycleDays : undefined,
      ownerId: typeof body.ownerId === 'string' ? body.ownerId : undefined,
    });
    res.json({ data });
  }),
);

internalRouter.get(
  '/jobs',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    res.json({ data: { jobs: listBackgroundJobNames() } });
  }),
);

internalRouter.post(
  '/jobs/run-due',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    const data = await runDueBackgroundJobs();
    res.status(data.allSucceeded ? 200 : 207).json({ data });
  }),
);

internalRouter.post(
  '/jobs/:name/run',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const name = req.params.name;
    if (!name || !isBackgroundJobName(name)) {
      res.status(400).json({
        error: 'Unknown or missing job name',
        code: 'VALIDATION_ERROR',
        jobs: listBackgroundJobNames(),
      });
      return;
    }
    const data = await runBackgroundJob(name);
    res.status(data.success ? 200 : 500).json({ data });
  }),
);
