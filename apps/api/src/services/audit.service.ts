import { prisma } from '@mazare3/db';
import type { Request } from 'express';

export async function createAuditLog(params: {
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}) {
  const { actorUserId, action, entityType, entityId, metadata, req } = params;

  await prisma.auditLog.create({
    data: {
      actorUserId: actorUserId ?? null,
      action,
      entityType,
      entityId,
      metadata: metadata ? (metadata as object) : undefined,
      ip: req?.ip ?? req?.socket?.remoteAddress,
      userAgent: req?.get('user-agent') ?? undefined,
    },
  });
}
