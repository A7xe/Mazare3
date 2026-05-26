import { prisma, OwnerStatus, type UserRole } from '@mazare3/db';
import { AppError } from '../lib/errors.js';

export type OwnerScope = {
  isAdmin: boolean;
  ownerProfileId: string | null;
};

export async function resolveOwnerScope(userId: string, role: UserRole): Promise<OwnerScope> {
  if (role === 'admin') {
    return { isAdmin: true, ownerProfileId: null };
  }
  if (role !== 'owner') {
    throw new AppError(403, 'FORBIDDEN', 'Owner access only');
  }
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) {
    throw new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved');
  }
  if (profile.status === OwnerStatus.suspended) {
    throw new AppError(403, 'OWNER_SUSPENDED', 'Owner account is suspended');
  }
  if (profile.status !== OwnerStatus.approved) {
    throw new AppError(403, 'OWNER_NOT_APPROVED', 'Owner profile not approved');
  }
  return { isAdmin: false, ownerProfileId: profile.id };
}
