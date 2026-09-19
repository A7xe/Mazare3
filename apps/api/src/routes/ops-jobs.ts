import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  requireInternalJobAuth,
  isInternalJobSecretConfigured,
} from '../middleware/require-internal-job-auth.js';
import {
  isBackgroundJobName,
  listBackgroundJobNames,
  runBackgroundJob,
  runDueBackgroundJobs,
  getBackgroundJobHealth,
  LAUNCH_CRITICAL_JOB_NAMES,
} from '../services/background-jobs.service.js';

/**
 * Production-safe job invocation (Phase 3C.4E.2C).
 * Always mounted. Mutating routes require INTERNAL_JOB_SECRET.
 * Do not use for browser/Customer traffic.
 */
export const opsJobsRouter = Router();

opsJobsRouter.get(
  '/jobs',
  requireInternalJobAuth,
  asyncHandler(async (_req, res) => {
    res.json({
      data: {
        jobs: listBackgroundJobNames(),
        launchCritical: [...LAUNCH_CRITICAL_JOB_NAMES],
        authConfigured: isInternalJobSecretConfigured(),
      },
    });
  }),
);

opsJobsRouter.get(
  '/jobs/health',
  requireInternalJobAuth,
  asyncHandler(async (_req, res) => {
    const health = await getBackgroundJobHealth();
    res.json({
      data: {
        generatedAt: new Date().toISOString(),
        jobs: health,
      },
    });
  }),
);

opsJobsRouter.post(
  '/jobs/run-due',
  requireInternalJobAuth,
  asyncHandler(async (_req, res) => {
    const data = await runDueBackgroundJobs();
    res.status(data.allSucceeded ? 200 : 207).json({ data });
  }),
);

opsJobsRouter.post(
  '/jobs/run-critical',
  requireInternalJobAuth,
  asyncHandler(async (_req, res) => {
    const data = await runDueBackgroundJobs([...LAUNCH_CRITICAL_JOB_NAMES]);
    res.status(data.allSucceeded ? 200 : 207).json({ data });
  }),
);

opsJobsRouter.post(
  '/jobs/:name/run',
  requireInternalJobAuth,
  asyncHandler(async (req, res) => {
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
