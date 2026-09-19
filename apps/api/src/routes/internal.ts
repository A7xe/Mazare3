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
  qaMarkVerifiedVisit,
  qaEnsurePropertyBookable,
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
import {
  clearMemoryEmailOutbox,
  getLastMemoryEmail,
  getMemoryEmailOutbox,
} from '../services/email/memory-email-provider.js';
import {
  clearMemorySmsOtpOutbox,
  getLastMemorySmsOtpForPhone,
  getMemorySmsOtpOutbox,
} from '../services/sms/memory-sms-otp-provider.js';
import { getSmsOtpProviderName } from '../config/phone-otp-config.js';
import { normalizeJordanPhoneE164 } from '../lib/phone-normalize.js';
import { clearLoginIdentifierAbuse } from '../services/login-abuse.service.js';
import { AuthIdentityProvider, UserRole, UserStatus, prisma } from '@mazare3/db';
import bcrypt from 'bcryptjs';
import {
  resetGoogleOidcMocksForQa,
  setGoogleOidcMocksForQa,
  type VerifiedGoogleIdentity,
} from '../services/google/google-oidc-client.js';

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
  '/bookings/:id/mark-verified-visit',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'booking id required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaMarkVerifiedVisit(id);
    res.json({ data });
  }),
);

internalRouter.post(
  '/properties/:slug/ensure-bookable',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'slug required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await qaEnsurePropertyBookable(slug);
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

/** AUTH-3 — memory email outbox for deterministic password-reset E2E (non-production only). */
internalRouter.get(
  '/email-outbox',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    res.json({
      data: {
        messages: getMemoryEmailOutbox(),
        last: getLastMemoryEmail() ?? null,
      },
    });
  }),
);

internalRouter.post(
  '/email-outbox/clear',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    clearMemoryEmailOutbox();
    res.json({ data: { cleared: true } });
  }),
);

/** AUTH-4 — clear identifier login-abuse state for a synthetic email (QA only). */
internalRouter.post(
  '/login-abuse/clear',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    if (!email) {
      throw new AppError(400, 'VALIDATION_ERROR', 'email is required');
    }
    await clearLoginIdentifierAbuse(email);
    res.json({ data: { cleared: true } });
  }),
);

/** AUTH-5 — clear shared IP rate-limit namespace (QA only). */
internalRouter.post(
  '/rate-limit/clear',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const namespace = req.body?.namespace;
    const allowed = [
      'auth-general',
      'auth-forgot-password',
      'auth-reset-password',
      'auth-phone-otp-send-ip',
      'auth-phone-otp-send-id',
      'auth-phone-otp-verify-ip',
      'auth-phone-otp-verify-id',
    ] as const;
    if (!(allowed as readonly string[]).includes(namespace)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'invalid namespace');
    }
    const { clearRateLimitNamespaceForQa } = await import(
      '../middleware/postgres-rate-limit-store.js'
    );
    const cleared = await clearRateLimitNamespaceForQa(namespace);
    res.json({ data: { cleared } });
  }),
);

/** AUTH-5 — increment a synthetic shared bucket (QA only). */
internalRouter.post(
  '/rate-limit/increment',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const namespace = req.body?.namespace;
    const keyHash = typeof req.body?.keyHash === 'string' ? req.body.keyHash : '';
    if (
      namespace !== 'auth-general' &&
      namespace !== 'auth-forgot-password' &&
      namespace !== 'auth-reset-password' &&
      namespace !== 'auth-phone-otp-send-ip' &&
      namespace !== 'auth-phone-otp-send-id' &&
      namespace !== 'auth-phone-otp-verify-ip' &&
      namespace !== 'auth-phone-otp-verify-id'
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'invalid namespace');
    }
    if (!/^[a-f0-9]{64}$/i.test(keyHash)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'keyHash must be 64 hex chars');
    }
    const { createAuthPostgresRateLimitStore } = await import(
      '../middleware/postgres-rate-limit-store.js'
    );
    const store = createAuthPostgresRateLimitStore(namespace);
    store.init({ windowMs: 15 * 60 * 1000 } as never);
    const result = await store.increment(keyHash.toLowerCase());
    res.json({
      data: {
        totalHits: result.totalHits,
        resetTime: result.resetTime?.toISOString() ?? null,
      },
    });
  }),
);

internalRouter.get(
  '/rate-limit/hits',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const namespace = req.query.namespace;
    const keyHash = typeof req.query.keyHash === 'string' ? req.query.keyHash : '';
    if (
      namespace !== 'auth-general' &&
      namespace !== 'auth-forgot-password' &&
      namespace !== 'auth-reset-password' &&
      namespace !== 'auth-phone-otp-send-ip' &&
      namespace !== 'auth-phone-otp-send-id' &&
      namespace !== 'auth-phone-otp-verify-ip' &&
      namespace !== 'auth-phone-otp-verify-id'
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'invalid namespace');
    }
    if (!/^[a-f0-9]{64}$/i.test(keyHash)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'keyHash must be 64 hex chars');
    }
    const { getRateLimitBucketHitsForQa } = await import(
      '../middleware/postgres-rate-limit-store.js'
    );
    const hits = await getRateLimitBucketHitsForQa(namespace, keyHash.toLowerCase());
    res.json({ data: { hits } });
  }),
);

/** UA-2 — memory SMS OTP outbox (QA only; never production). */
internalRouter.get(
  '/sms-otp-outbox',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    if (getSmsOtpProviderName() !== 'memory') {
      throw new AppError(403, 'FORBIDDEN', 'SMS memory outbox requires SMS_OTP_PROVIDER=memory');
    }
    const rows = getMemorySmsOtpOutbox().map((r) => ({
      toE164: r.toE164,
      code: r.code,
      locale: r.locale,
      createdAt: r.createdAt,
      providerRef: r.providerRef,
    }));
    res.json({ data: { messages: rows } });
  }),
);

internalRouter.get(
  '/sms-otp-outbox/latest',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    if (getSmsOtpProviderName() !== 'memory') {
      throw new AppError(403, 'FORBIDDEN', 'SMS memory outbox requires SMS_OTP_PROVIDER=memory');
    }
    const phoneRaw = typeof req.query.phone === 'string' ? req.query.phone : '';
    if (!phoneRaw) {
      throw new AppError(400, 'VALIDATION_ERROR', 'phone query required');
    }
    const e164 = normalizeJordanPhoneE164(phoneRaw);
    const row = getLastMemorySmsOtpForPhone(e164);
    if (!row) {
      res.status(404).json({ error: 'No OTP captured for phone', code: 'NOT_FOUND' });
      return;
    }
    res.json({
      data: {
        toE164: row.toE164,
        code: row.code,
        locale: row.locale,
        createdAt: row.createdAt,
        providerRef: row.providerRef,
      },
    });
  }),
);

internalRouter.post(
  '/sms-otp-outbox/clear',
  asyncHandler(async (_req, res) => {
    requireInternalQa();
    clearMemorySmsOtpOutbox();
    res.json({ data: { cleared: true } });
  }),
);

/** UA-6A — Google OIDC verifier mock (APP_ENV≠production + internal QA only). */
internalRouter.post(
  '/qa/google-oidc-mock',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as {
      identity?: Partial<VerifiedGoogleIdentity> & { sub?: string };
      reset?: boolean;
    };
    if (body.reset) {
      resetGoogleOidcMocksForQa();
      res.json({ data: { reset: true } });
      return;
    }
    const sub = typeof body.identity?.sub === 'string' ? body.identity.sub.trim() : '';
    if (!sub) {
      throw new AppError(400, 'VALIDATION_ERROR', 'identity.sub required');
    }
    const identity: VerifiedGoogleIdentity = {
      sub,
      email: body.identity?.email ?? null,
      emailVerified: body.identity?.emailVerified !== false,
      name: body.identity?.name ?? null,
    };
    setGoogleOidcMocksForQa({
      verifyIdToken: async () => identity,
    });
    res.json({
      data: {
        mocked: true,
        sub: identity.sub,
        email: identity.email,
        emailVerified: identity.emailVerified,
      },
    });
  }),
);

function assertUa6aFixtureEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^ua6a\.[a-z0-9._+-]+@example\.com$/.test(normalized)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'QA cleanup/create only allows ua6a.*@example.com emails',
    );
  }
  return normalized;
}

function assertUa6aFixturePhone(phone: string): string {
  const e164 = normalizeJordanPhoneE164(phone);
  if (!/^\+962799\d{6}$/.test(e164)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'QA phone fixtures must use +962799xxxxxx',
    );
  }
  return e164;
}

internalRouter.post(
  '/qa/users/create-password',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
      phone?: string | null;
      attachPasswordIdentity?: boolean;
    };
    const email = assertUa6aFixtureEmail(String(body.email ?? ''));
    const password = String(body.password ?? '');
    if (password.length < 8) {
      throw new AppError(400, 'VALIDATION_ERROR', 'password min 8');
    }
    const phone =
      body.phone == null || body.phone === ''
        ? null
        : assertUa6aFixturePhone(String(body.phone));
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: typeof body.name === 'string' ? body.name.trim() || null : 'UA6A Fixture',
        passwordHash,
        passwordChangedAt: new Date(),
        phone,
        role: UserRole.customer,
        status: UserStatus.active,
        locale: 'ar',
      },
    });
    if (body.attachPasswordIdentity !== false) {
      await prisma.authIdentity.create({
        data: {
          userId: user.id,
          provider: AuthIdentityProvider.password,
          providerSubject: email,
          verifiedAt: new Date(),
        },
      });
    }
    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        passwordHashPresent: Boolean(user.passwordHash),
      },
    });
  }),
);

internalRouter.post(
  '/qa/users/attach-phone-identity',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as { email?: string; phone?: string };
    const email = assertUa6aFixtureEmail(String(body.email ?? ''));
    const e164 = assertUa6aFixturePhone(String(body.phone ?? ''));
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    if (!user.email?.startsWith('ua6a.')) {
      throw new AppError(403, 'FORBIDDEN', 'Not a UA6A fixture user');
    }
    const identity = await prisma.authIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: AuthIdentityProvider.phone,
          providerSubject: e164,
        },
      },
      create: {
        userId: user.id,
        provider: AuthIdentityProvider.phone,
        providerSubject: e164,
        verifiedAt: new Date(),
      },
      update: {
        userId: user.id,
        verifiedAt: new Date(),
      },
    });
    res.json({
      data: {
        userId: user.id,
        identityId: identity.id,
        phone: e164,
        verifiedAt: identity.verifiedAt,
      },
    });
  }),
);

internalRouter.post(
  '/qa/users/attach-google-identity',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as { email?: string; sub?: string };
    const email = assertUa6aFixtureEmail(String(body.email ?? ''));
    const sub = String(body.sub ?? '').trim();
    if (!sub.startsWith('ua6a-google-')) {
      throw new AppError(400, 'VALIDATION_ERROR', 'sub must start with ua6a-google-');
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    const identity = await prisma.authIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: AuthIdentityProvider.google,
          providerSubject: sub,
        },
      },
      create: {
        userId: user.id,
        provider: AuthIdentityProvider.google,
        providerSubject: sub,
        verifiedAt: new Date(),
      },
      update: {
        userId: user.id,
        verifiedAt: new Date(),
      },
    });
    res.json({
      data: { userId: user.id, identityId: identity.id, sub },
    });
  }),
);

internalRouter.post(
  '/qa/users/cleanup',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as {
      email?: string;
      emails?: string[];
      phone?: string;
      phones?: string[];
    };
    const emails = [
      ...(body.email ? [body.email] : []),
      ...(Array.isArray(body.emails) ? body.emails : []),
    ].map((e) => assertUa6aFixtureEmail(String(e)));
    const phones = [
      ...(body.phone ? [body.phone] : []),
      ...(Array.isArray(body.phones) ? body.phones : []),
    ].map((p) => assertUa6aFixturePhone(String(p)));

    const deleted: string[] = [];

    for (const email of emails) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, _count: { select: { bookings: true } } },
      });
      if (!user) continue;
      if (user._count.bookings > 0) {
        throw new AppError(409, 'CONFLICT', `Cannot cleanup user with bookings: ${email}`);
      }
      await prisma.authIdentity.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.favorite.deleteMany({ where: { userId: user.id } });
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      deleted.push(user.id);
    }

    for (const e164 of phones) {
      const identity = await prisma.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: AuthIdentityProvider.phone,
            providerSubject: e164,
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              _count: { select: { bookings: true } },
            },
          },
        },
      });
      if (!identity) {
        const legacy = await prisma.user.findFirst({
          where: { phone: e164, email: { startsWith: 'ua6a.' } },
          select: { id: true, email: true, _count: { select: { bookings: true } } },
        });
        if (legacy) {
          if (legacy._count.bookings > 0) {
            throw new AppError(409, 'CONFLICT', `Cannot cleanup user with bookings: ${legacy.email}`);
          }
          await prisma.authIdentity.deleteMany({ where: { userId: legacy.id } });
          await prisma.passwordResetToken.deleteMany({ where: { userId: legacy.id } });
          await prisma.favorite.deleteMany({ where: { userId: legacy.id } });
          await prisma.notification.deleteMany({ where: { userId: legacy.id } });
          await prisma.user.delete({ where: { id: legacy.id } });
          deleted.push(legacy.id);
        }
        continue;
      }
      const user = identity.user;
      if (user._count.bookings > 0) {
        throw new AppError(409, 'CONFLICT', `Cannot cleanup user with bookings: ${user.email}`);
      }
      if (user.email && !user.email.startsWith('ua6a.')) {
        throw new AppError(403, 'FORBIDDEN', 'Refusing non-fixture cleanup');
      }
      await prisma.authIdentity.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.favorite.deleteMany({ where: { userId: user.id } });
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      deleted.push(user.id);
    }

    res.json({ data: { deletedUserIds: deleted } });
  }),
);

/** CB-5B — process-scoped charge mode override for mock E2E (never production). */
internalRouter.post(
  '/qa/paytabs-saved-card-charge-mode',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const body = (req.body ?? {}) as {
      mode?: string;
      recurringEnabled?: boolean;
    };
    const mode = String(body.mode ?? 'off').trim().toLowerCase();
    if (!['off', 'ecom_cvv_redirect', 'recurring_direct'].includes(mode)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid saved card charge mode');
    }
    process.env.PAYTABS_SAVED_CARD_CHARGE_MODE = mode;
    if (typeof body.recurringEnabled === 'boolean') {
      process.env.PAYTABS_RECURRING_ENABLED = body.recurringEnabled ? 'true' : 'false';
    }
    if (mode === 'recurring_direct' && process.env.PAYTABS_RECURRING_ENABLED !== 'true') {
      // Explicit: recurring_direct without flag stays inactive via resolveSavedCardChargeMode.
    }
    res.json({
      data: {
        mode: process.env.PAYTABS_SAVED_CARD_CHARGE_MODE,
        recurringEnabled: process.env.PAYTABS_RECURRING_ENABLED === 'true',
      },
    });
  }),
);

internalRouter.post(
  '/qa/mock-saved-card-outcome',
  asyncHandler(async (req, res) => {
    requireInternalQa();
    const outcome = String((req.body as { outcome?: string })?.outcome ?? '')
      .trim()
      .toLowerCase();
    if (
      outcome &&
      !['', 'ecom_redirect', 'authorised', 'declined', 'invalid_token', 'network_unknown'].includes(
        outcome,
      )
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid mock saved card outcome');
    }
    if (!outcome) delete process.env.MOCK_SAVED_CARD_OUTCOME;
    else process.env.MOCK_SAVED_CARD_OUTCOME = outcome;
    res.json({ data: { outcome: process.env.MOCK_SAVED_CARD_OUTCOME ?? null } });
  }),
);
