'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import type { PropertyMediaItem } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addOwnerPropertyMediaUrl,
  deleteOwnerPropertyMedia,
  reorderOwnerPropertyMedia,
  setOwnerPropertyMediaCover,
  uploadOwnerPropertyMediaFile,
  OwnerApiError,
} from '@/lib/api-owner';

type Props = {
  propertyId: string;
  media: PropertyMediaItem[];
  onMediaChange: (media: PropertyMediaItem[]) => void;
  disabled?: boolean;
  /** When true, ask before deleting an uploaded photo. */
  confirmDelete?: boolean;
  /** Hide external URL import (wizard prefers file upload only). */
  hideUrlAdd?: boolean;
};

function mediaErrorMessage(
  e: unknown,
  t: (key:
    | 'mediaErrorTooLarge'
    | 'mediaErrorType'
    | 'mediaErrorLimit'
    | 'mediaErrorStorage'
    | 'mediaUploadFailed') => string,
): string {
  const code = e instanceof OwnerApiError ? e.code : undefined;
  if (code === 'PAYLOAD_TOO_LARGE' || code === 'FILE_TOO_LARGE') return t('mediaErrorTooLarge');
  if (code === 'FILE_TYPE_REJECTED' || code === 'MIME_MISMATCH' || code === 'EMPTY_FILE') {
    return t('mediaErrorType');
  }
  if (code === 'MEDIA_LIMIT_REACHED') return t('mediaErrorLimit');
  if (
    code === 'PROPERTY_MEDIA_STORAGE_DENIED' ||
    code === 'PROPERTY_MEDIA_STORAGE_FAILED' ||
    code === 'PROPERTY_MEDIA_STORAGE_MISCONFIGURED'
  ) {
    return t('mediaErrorStorage');
  }
  return t('mediaUploadFailed');
}

function MediaThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-primary-soft px-3 text-center text-xs text-muted">
        {alt}
      </div>
    );
  }
  return (
    // Owner gallery must render R2/legacy hosts without next/image remotePatterns.
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function OwnerPropertyMediaEditor({
  propertyId,
  media,
  onMediaChange,
  disabled = false,
  confirmDelete = false,
  hideUrlAdd = false,
}: Props) {
  const t = useTranslations('ownerProperty');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [urlToAdd, setUrlToAdd] = useState('');

  useEffect(() => {
    const urls = pendingFiles.map((file) => URL.createObjectURL(file));
    setPendingPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [pendingFiles]);

  const busyLocked = busy || disabled;

  function clearPending() {
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function runMediaAction(action: () => Promise<PropertyMediaItem[]>) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await action();
      onMediaChange(next);
      return next;
    } catch (e) {
      setError(mediaErrorMessage(e, (key) => t(key)));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function uploadSelected() {
    if (!pendingFiles.length || busyLocked) return;
    const files = [...pendingFiles];
    setBusy(true);
    setError(null);
    setSuccess(null);
    let current = media;
    let uploaded = 0;
    try {
      for (const file of files) {
        const res = await uploadOwnerPropertyMediaFile(propertyId, file);
        current = res.data.media;
        uploaded += 1;
        onMediaChange(current);
      }
      clearPending();
      setSuccess(t('mediaUploadSuccess', { count: uploaded }));
    } catch (e) {
      onMediaChange(current);
      if (uploaded > 0) {
        setPendingFiles(files.slice(uploaded));
        setSuccess(t('mediaUploadSuccess', { count: uploaded }));
      }
      setError(mediaErrorMessage(e, (key) => t(key)));
    } finally {
      setBusy(false);
    }
  }

  async function addUrl() {
    const url = urlToAdd.trim();
    if (!url || busyLocked) return;
    const next = await runMediaAction(async () => {
      const res = await addOwnerPropertyMediaUrl(propertyId, url);
      return res.data.media;
    });
    if (next) {
      setUrlToAdd('');
      setSuccess(t('mediaUrlAdded'));
    }
  }

  async function removeMedia(mediaId: string) {
    if (busyLocked) return;
    if (confirmDelete && typeof window !== 'undefined') {
      if (!window.confirm(t('mediaDeleteConfirm'))) return;
    }
    const next = await runMediaAction(async () => {
      const res = await deleteOwnerPropertyMedia(propertyId, mediaId);
      return res.data.media;
    });
    if (next) setSuccess(t('mediaDeleted'));
  }

  async function makeCover(mediaId: string) {
    if (busyLocked) return;
    const next = await runMediaAction(async () => {
      const res = await setOwnerPropertyMediaCover(propertyId, mediaId);
      return res.data.media;
    });
    if (next) setSuccess(t('mediaCoverUpdated'));
  }

  async function move(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= media.length || busyLocked) return;
    const ids = media.map((item) => item.id);
    const swapped = [...ids];
    const current = swapped[index]!;
    swapped[index] = swapped[newIndex]!;
    swapped[newIndex] = current;
    const next = await runMediaAction(async () => {
      const res = await reorderOwnerPropertyMedia(propertyId, swapped);
      return res.data.media;
    });
    if (next) setSuccess(t('mediaReordered'));
  }

  const selectedLabel = useMemo(
    () => t('mediaSelected', { count: pendingFiles.length }),
    [pendingFiles.length, t],
  );

  return (
    <section className="space-y-4" data-testid="owner-media-editor">
      <div>
        <h2 className="text-sm font-medium text-navy">{t('mediaUpload')}</h2>
        <p className="mt-1 text-xs text-muted">{t('mediaGalleryHint')}</p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-navy"
        >
          {success}
        </p>
      )}

      {media.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-primary/25 bg-primary-soft/40 px-4 py-8 text-center text-sm text-muted">
          {t('mediaEmpty')}
        </p>
      ) : (
        <div
          className="grid grid-cols-2 gap-3 lg:grid-cols-3"
          data-testid="owner-media-gallery"
        >
          {media.map((item, index) => (
            <article
              key={item.id}
              data-testid="owner-media-card"
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            >
              <div className="relative aspect-[4/3] bg-primary-soft" data-testid="owner-media-thumb">
                <MediaThumb
                  src={item.url}
                  alt={item.altAr ?? item.altEn ?? t('imageUrls')}
                />
                {item.isCover && (
                  <span
                    data-testid="owner-media-cover-badge"
                    className="absolute start-2 top-2 rounded-lg bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                  >
                    {t('mediaCoverPhoto')}
                  </span>
                )}
                <span className="absolute end-2 top-2 rounded-lg bg-navy/70 px-2 py-1 text-[11px] font-medium text-white">
                  {t('mediaOrder', { n: index + 1 })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 p-2">
                {!item.isCover && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyLocked}
                    data-testid="owner-media-set-cover"
                    onClick={() => void makeCover(item.id)}
                  >
                    {t('mediaSetCover')}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyLocked || index === 0}
                  aria-label={t('mediaMoveUp')}
                  data-testid="owner-media-move-up"
                  onClick={() => void move(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyLocked || index === media.length - 1}
                  aria-label={t('mediaMoveDown')}
                  data-testid="owner-media-move-down"
                  onClick={() => void move(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ms-auto text-danger hover:bg-danger/10 hover:text-danger"
                  disabled={busyLocked}
                  aria-label={t('mediaDelete')}
                  data-testid="owner-media-delete"
                  onClick={() => void removeMedia(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-primary/15 bg-primary-soft/30 p-4">
        <input
          ref={fileInputRef}
          id="owner-media-file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          disabled={busyLocked}
          onChange={(e) => {
            setPendingFiles(Array.from(e.target.files ?? []));
            setSuccess(null);
          }}
        />
        <button
          type="button"
          disabled={busyLocked}
          data-testid="owner-media-choose"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-primary/35 bg-surface px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary-soft/50 disabled:opacity-50"
        >
          <ImagePlus className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium text-navy">{t('mediaChooseFiles')}</span>
          <span className="text-xs text-muted">{t('mediaFormats')}</span>
          <span className="text-xs text-muted">{t('mediaMaxSize')}</span>
        </button>

        {pendingFiles.length > 0 && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-navy">{selectedLabel}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pendingPreviews.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-primary-soft">
                  {/* Local object URLs — not remote. */}
                  <img
                    src={src}
                    alt={pendingFiles[i]?.name ?? t('imageUrls')}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busyLocked}
                data-testid="owner-media-upload-cta"
                onClick={() => void uploadSelected()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? t('mediaUploading') : t('mediaUploadCta')}
              </Button>
              <Button type="button" variant="outline" disabled={busyLocked} onClick={clearPending}>
                {t('mediaClearSelection')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {hideUrlAdd ? null : (
        <div>
          <p className="mb-1 text-sm font-medium text-navy">{t('mediaAddUrl')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={t('mediaUrlPlaceholder')}
              value={urlToAdd}
              disabled={busyLocked}
              onChange={(e) => setUrlToAdd(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busyLocked || !urlToAdd.trim()}
              onClick={() => void addUrl()}
            >
              {t('addImage')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
