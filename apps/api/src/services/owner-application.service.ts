import { prisma, OwnerStatus, UserRole } from '@mazare3/db';
import type { OwnerApplyInput, OwnerApplicationView } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { notifyOwnerApplicationSubmitted } from './notification.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ensureOwnerOnboarding } from './partner-onboarding.service.js';

function mapApplication(profile: {
  id: string;
  status: OwnerStatus;
  displayName: string;
  businessName: string | null;
  phone: string;
  city: string | null;
  area: string | null;
  bio: string | null;
  approximateFarmCount: number | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OwnerApplicationView {
  return {
    id: profile.id,
    status: profile.status,
    displayName: profile.displayName,
    businessName: profile.businessName,
    phone: profile.phone,
    city: profile.city,
    area: profile.area,
    bio: profile.bio,
    approximateFarmCount: profile.approximateFarmCount,
    rejectionReason: profile.rejectionReason,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

async function persistApplicationFields(ownerProfileId: string, input: OwnerApplyInput) {
  return prisma.ownerProfile.update({
    where: { id: ownerProfileId },
    data: {
      displayName: input.displayName.trim(),
      businessName: input.businessName?.trim() || null,
      phone: input.phone.trim(),
      city: input.city.trim(),
      area: input.area.trim(),
      bio: input.bio.trim(),
      approximateFarmCount: input.approximateFarmCount ?? null,
      termsAcceptedAt: new Date(),
      status: OwnerStatus.pending,
      rejectionReason: null,
    },
  });
}

export async function submitOwnerApplication(
  userId: string,
  userRole: UserRole,
  input: OwnerApplyInput,
  req?: AuthenticatedRequest,
): Promise<OwnerApplicationView> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!dbUser || dbUser.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
  }
  const liveRole = dbUser.role;
  if (liveRole === 'admin') {
    throw new AppError(400, 'ADMIN_NO_APPLY', 'Admins do not need to apply');
  }
  if (liveRole === 'owner' || userRole === 'admin') {
    throw new AppError(400, 'ALREADY_OWNER', 'You are already an approved owner');
  }

  const existing = await prisma.ownerProfile.findUnique({ where: { userId } });
  if (existing) {
    if (existing.status === OwnerStatus.approved) {
      throw new AppError(409, 'APPLICATION_EXISTS', 'You already have a pending or approved application');
    }
    if (existing.status === OwnerStatus.suspended) {
      throw new AppError(403, 'OWNER_SUSPENDED', 'Your owner account is suspended');
    }
    const updated = await persistApplicationFields(existing.id, input);
    await ensureOwnerOnboarding(userId);
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.application_submitted',
      entityType: 'owner_profile',
      entityId: updated.id,
      metadata: { compatibilityRoute: true, reapplied: existing.status === OwnerStatus.rejected },
      req,
    });
    return mapApplication(updated);
  }

  const created = await prisma.ownerProfile.create({
    data: {
      userId,
      displayName: input.displayName.trim(),
      businessName: input.businessName?.trim() || null,
      phone: input.phone.trim(),
      city: input.city.trim(),
      area: input.area.trim(),
      bio: input.bio.trim(),
      approximateFarmCount: input.approximateFarmCount ?? null,
      termsAcceptedAt: new Date(),
      status: OwnerStatus.pending,
    },
  });
  await ensureOwnerOnboarding(userId);

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.application_submitted',
    entityType: 'owner_profile',
    entityId: created.id,
    metadata: { compatibilityRoute: true },
    req,
  });

  void notifyOwnerApplicationSubmitted({
    ownerProfileId: created.id,
    displayName: created.displayName,
  }).catch((err) => console.error('[notifications] owner.application_submitted', err));

  return mapApplication(created);
}

export async function getMyOwnerApplication(userId: string): Promise<OwnerApplicationView | null> {
  const profile = await prisma.ownerProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  return mapApplication(profile);
}

export async function getOwnerProfileStatusForUser(
  userId: string,
  role: UserRole,
): Promise<{ status: string | null; rejectionReason: string | null }> {
  if (role === 'admin') {
    return { status: 'approved', rejectionReason: null };
  }
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId },
    select: { status: true, rejectionReason: true },
  });
  if (!profile) {
    return { status: null, rejectionReason: null };
  }
  return { status: profile.status, rejectionReason: profile.rejectionReason };
}
