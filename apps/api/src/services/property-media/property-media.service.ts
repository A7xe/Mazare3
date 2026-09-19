import { prisma, MediaType, type PropertyStatus } from '@mazare3/db';
import type { Express } from 'express';
import type { UserRole } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { PropertyMediaItem } from '@mazare3/shared';
import { createAuditLog } from '../audit.service.js';
import { resolveOwnerScope } from '../owner-access.js';
import { assertOwnerNotPendingReview } from '../../lib/owner-property-mutation-guards.js';
import {
  assertMediaProviderReady,
  getActiveStorageProvider,
} from './storage/get-storage-provider.js';
import { loadMediaConfig } from '../../config/media-config.js';
import { assertPropertyImageUpload } from '../../lib/property-media-file-magic.js';
import { resolvePropertyMediaPublicUrl } from '../../lib/property-media-public-url.js';

const MAX_MEDIA_PER_PROPERTY = 12;

function allowedExtsFromMimes(allowedMimes: string[]): string[] {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return allowedMimes
    .map((m) => map[m])
    .filter((ext): ext is string => Boolean(ext));
}

function normalizeExt(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.jpeg')) return '.jpg';
  return lower.match(/\.[a-z0-9]+$/)?.[0] ?? '';
}

function validateImageUrl(urlStr: string, allowedMimes: string[]): void {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new AppError(400, 'INVALID_MEDIA_URL', 'Invalid image URL');
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new AppError(400, 'INVALID_MEDIA_URL', 'Only http/https URLs are allowed');
  }

  // Basic safety (no SVG / obvious HTML / data:)
  if (urlStr.toLowerCase().includes('data:')) {
    throw new AppError(400, 'INVALID_MEDIA_URL', 'data: URLs are not allowed');
  }
  if (urlStr.toLowerCase().includes('<') || urlStr.toLowerCase().includes('>')) {
    throw new AppError(400, 'INVALID_MEDIA_URL', 'Invalid image URL');
  }

  const allowedExts = allowedExtsFromMimes(allowedMimes);
  const ext = normalizeExt(u.pathname);
  if (ext && !allowedExts.includes(ext)) {
    throw new AppError(
      400,
      'INVALID_MEDIA_URL',
      `Only images are allowed (${allowedExts.join(', ')})`,
    );
  }

  if (!ext) {
    const host = u.hostname.toLowerCase();
    const trustedHosts = ['images.unsplash.com', 'res.cloudinary.com', 'i.imgur.com'];
    const trusted = trustedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    if (!trusted) {
      throw new AppError(
        400,
        'INVALID_MEDIA_URL',
        `Image URL must end with ${allowedExts.join(', ')} or use a trusted image host`,
      );
    }
  }
}

function toPropertyMediaItem(
  m: {
    id: string;
    propertyId: string;
    type: MediaType;
    url: string;
    storageKey: string | null;
    thumbnailUrl: string | null;
    altAr: string | null;
    altEn: string | null;
    sortOrder: number;
    createdAt: Date;
  },
): PropertyMediaItem {
  return {
    id: m.id,
    propertyId: m.propertyId,
    url: resolvePropertyMediaPublicUrl({ url: m.url, storageKey: m.storageKey }),
    storageKey: m.storageKey,
    type: m.type === MediaType.image ? 'image' : 'image',
    altAr: m.altAr,
    altEn: m.altEn,
    sortOrder: m.sortOrder,
    isCover: m.sortOrder === 0,
    createdAt: m.createdAt.toISOString(),
  };
}

async function loadOrderedMedia(propertyId: string): Promise<PropertyMediaItem[]> {
  const rows = await prisma.propertyMedia.findMany({
    where: { propertyId, removedFromListingAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((m) =>
    toPropertyMediaItem({
      id: m.id,
      propertyId: m.propertyId,
      type: m.type,
      url: m.url,
      storageKey: m.storageKey ?? null,
      thumbnailUrl: m.thumbnailUrl ?? null,
      altAr: m.altAr ?? null,
      altEn: m.altEn ?? null,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt,
    }),
  );
}

async function assertCanManageProperty(params: {
  userId: string;
  role: UserRole;
  propertyId: string;
}): Promise<{ isAdmin: boolean; ownerProfileId: string | null; status: PropertyStatus }> {
  const scope = await resolveOwnerScope(params.userId, params.role);
  if (scope.isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Owners only');
  }
  const property = await prisma.property.findFirst({
    where: { id: params.propertyId, ownerId: scope.ownerProfileId! },
    select: { id: true, status: true },
  });
  if (!property) {
    throw new AppError(403, 'PROPERTY_MEDIA_NOT_OWNED', 'You cannot manage this property media');
  }
  assertOwnerNotPendingReview(property.status);
  return { ...scope, status: property.status };
}

async function getNextSortOrder(propertyId: string): Promise<number> {
  const maxRow = await prisma.propertyMedia.findFirst({
    where: { propertyId, removedFromListingAt: null },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (maxRow?.sortOrder ?? -1) + 1;
}

export async function addPropertyMediaUrl(params: {
  actorUserId: string;
  role: UserRole;
  propertyId: string;
  url: string;
  altAr?: string | null;
  altEn?: string | null;
  req?: AuthenticatedRequest;
}): Promise<{ media: PropertyMediaItem[] }> {
  await assertCanManageProperty({
    userId: params.actorUserId,
    role: params.role,
    propertyId: params.propertyId,
  });

  const { allowedMimes } = (() => {
    const cfg = loadMediaConfig();
    return { allowedMimes: cfg.allowedImageMimes };
  })();

  validateImageUrl(params.url, allowedMimes);

  const count = await prisma.propertyMedia.count({
    where: { propertyId: params.propertyId, removedFromListingAt: null },
  });
  if (count >= MAX_MEDIA_PER_PROPERTY) {
    throw new AppError(400, 'MEDIA_LIMIT_REACHED', `Max ${MAX_MEDIA_PER_PROPERTY} images per property`);
  }

  const sortOrder = await getNextSortOrder(params.propertyId);
  const media = await prisma.propertyMedia.create({
    data: {
      propertyId: params.propertyId,
      type: MediaType.image,
      url: params.url,
      sortOrder,
      altAr: params.altAr ?? null,
      altEn: params.altEn ?? null,
    },
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.media_uploaded',
    entityType: 'property',
    entityId: params.propertyId,
    metadata: { mediaId: media.id, storage: 'url' },
    req: params.req,
  });

  return { media: await loadOrderedMedia(params.propertyId) };
}

export async function addPropertyMediaFile(params: {
  actorUserId: string;
  role: UserRole;
  propertyId: string;
  file: Express.Multer.File;
  altAr?: string | null;
  altEn?: string | null;
  req?: AuthenticatedRequest;
}): Promise<{ media: PropertyMediaItem[] }> {
  await assertCanManageProperty({
    userId: params.actorUserId,
    role: params.role,
    propertyId: params.propertyId,
  });

  const cfg = loadMediaConfig();
  const detected = assertPropertyImageUpload({
    buffer: params.file.buffer,
    declaredMime: params.file.mimetype,
    originalName: params.file.originalname ?? 'image',
    maxBytes: cfg.maxUploadBytes,
    allowedMimes: cfg.allowedImageMimes,
  });
  params.file.mimetype = detected.mime;

  assertMediaProviderReady();

  const count = await prisma.propertyMedia.count({
    where: { propertyId: params.propertyId, removedFromListingAt: null },
  });
  if (count >= MAX_MEDIA_PER_PROPERTY) {
    throw new AppError(400, 'MEDIA_LIMIT_REACHED', `Max ${MAX_MEDIA_PER_PROPERTY} images per property`);
  }

  const sortOrder = await getNextSortOrder(params.propertyId);
  const storage = getActiveStorageProvider();
  const uploaded = await storage.uploadImage(params.file, {
    propertyId: params.propertyId,
    uploadedByUserId: params.actorUserId,
  });

  const media = await prisma.propertyMedia.create({
    data: {
      propertyId: params.propertyId,
      type: MediaType.image,
      url: uploaded.url,
      storageKey: uploaded.storageKey,
      thumbnailUrl: uploaded.thumbnailUrl ?? null,
      sortOrder,
      altAr: params.altAr ?? null,
      altEn: params.altEn ?? null,
    },
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.media_uploaded',
    entityType: 'property',
    entityId: params.propertyId,
    metadata: { mediaId: media.id, storageKey: uploaded.storageKey },
    req: params.req,
  });

  return { media: await loadOrderedMedia(params.propertyId) };
}

export async function patchPropertyMedia(params: {
  actorUserId: string;
  role: UserRole;
  propertyId: string;
  mediaId: string;
  altAr?: string | null;
  altEn?: string | null;
  req?: AuthenticatedRequest;
}): Promise<{ media: PropertyMediaItem[] }> {
  await assertCanManageProperty({
    userId: params.actorUserId,
    role: params.role,
    propertyId: params.propertyId,
  });

  const existing = await prisma.propertyMedia.findFirst({
    where: { id: params.mediaId, propertyId: params.propertyId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Media not found');

  await prisma.propertyMedia.update({
    where: { id: params.mediaId },
    data: {
      altAr: params.altAr ?? null,
      altEn: params.altEn ?? null,
    },
  });

  return { media: await loadOrderedMedia(params.propertyId) };
}

export async function deletePropertyMedia(params: {
  actorUserId: string;
  role: UserRole;
  propertyId: string;
  mediaId: string;
  req?: AuthenticatedRequest;
}): Promise<{ media: PropertyMediaItem[] }> {
  await assertCanManageProperty({
    userId: params.actorUserId,
    role: params.role,
    propertyId: params.propertyId,
  });

  const existing = await prisma.propertyMedia.findFirst({
    where: { id: params.mediaId, propertyId: params.propertyId, removedFromListingAt: null },
    select: { id: true, storageKey: true },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Media not found');

  // Phase 3C.4D.6 — soft-remove from live listing; retain row/storage for Booking snapshots.
  // Do NOT delete object storage here — historical snapshot URLs/keys must remain recoverable.
  await prisma.$transaction(async (tx) => {
    await tx.propertyMedia.update({
      where: { id: params.mediaId },
      data: { removedFromListingAt: new Date() },
    });
    const remaining = await tx.propertyMedia.findMany({
      where: { propertyId: params.propertyId, removedFromListingAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, sortOrder: true },
    });
    for (let i = 0; i < remaining.length; i++) {
      await tx.propertyMedia.update({
        where: { id: remaining[i]!.id },
        data: { sortOrder: i },
      });
    }
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.media_removed_from_listing',
    entityType: 'property',
    entityId: params.propertyId,
    metadata: { mediaId: params.mediaId, softRemoved: true },
    req: params.req,
  });

  return { media: await loadOrderedMedia(params.propertyId) };
}

export async function setPropertyMediaCover(params: {
  actorUserId: string;
  role: UserRole;
  propertyId: string;
  mediaId: string;
  req?: AuthenticatedRequest;
}): Promise<{ media: PropertyMediaItem[] }> {
  await assertCanManageProperty({
    userId: params.actorUserId,
    role: params.role,
    propertyId: params.propertyId,
  });

  const ordered = await prisma.propertyMedia.findMany({
    where: { propertyId: params.propertyId, removedFromListingAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = ordered.findIndex((m) => m.id === params.mediaId);
  if (idx === -1) throw new AppError(404, 'NOT_FOUND', 'Media not found');

  if (idx === 0) return { media: await loadOrderedMedia(params.propertyId) };

  await prisma.$transaction(async (tx) => {
    const selected = ordered[idx]!;
    const nextOrder = [selected, ...ordered.filter((m) => m.id !== selected.id)].map((m, i) => ({
      id: m.id,
      sortOrder: i,
    }));
    for (const row of nextOrder) {
      await tx.propertyMedia.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } });
    }
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.media_cover_changed',
    entityType: 'property',
    entityId: params.propertyId,
    metadata: { mediaId: params.mediaId },
    req: params.req,
  });

  return { media: await loadOrderedMedia(params.propertyId) };
}

export async function reorderPropertyMedia(params: {
  actorUserId: string;
  role: UserRole;
  propertyId: string;
  mediaIds: string[];
  req?: AuthenticatedRequest;
}): Promise<{ media: PropertyMediaItem[] }> {
  await assertCanManageProperty({
    userId: params.actorUserId,
    role: params.role,
    propertyId: params.propertyId,
  });

  const ordered = await prisma.propertyMedia.findMany({
    where: { propertyId: params.propertyId, removedFromListingAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });

  if (params.mediaIds.length !== ordered.length) {
    throw new AppError(
      400,
      'MEDIA_REORDER_INVALID',
      'Reorder must include all live property media items',
    );
  }

  const existingIds = new Set(ordered.map((m) => m.id));
  for (const id of params.mediaIds) {
    if (!existingIds.has(id)) {
      throw new AppError(400, 'MEDIA_REORDER_INVALID', 'Invalid media id in reorder');
    }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < params.mediaIds.length; i++) {
      await tx.propertyMedia.update({
        where: { id: params.mediaIds[i]! },
        data: { sortOrder: i },
      });
    }
  });

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'property.media_reordered',
    entityType: 'property',
    entityId: params.propertyId,
    metadata: { mediaIds: params.mediaIds },
    req: params.req,
  });

  return { media: await loadOrderedMedia(params.propertyId) };
}

