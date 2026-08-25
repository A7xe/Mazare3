'use client';

import { assessPropertyMedia, MIN_MEDIA_FOR_PUBLISH } from '@mazare3/shared';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type MediaLike = { sortOrder: number; isCover?: boolean };

type Props = {
  media: MediaLike[];
  namespace: 'ownerProperty' | 'admin';
};

export function PropertyMediaQualityBox({ media, namespace }: Props) {
  const t = useTranslations(namespace);
  const assessment = assessPropertyMedia(media.map((m) => ({ sortOrder: m.sortOrder })));
  const remaining = Math.max(0, MIN_MEDIA_FOR_PUBLISH - assessment.count);

  const readyVariant = assessment.canPublish
    ? 'success'
    : assessment.canSubmitReview
      ? 'warning'
      : 'danger';

  const borderClass =
    readyVariant === 'success'
      ? 'border-primary/30 bg-primary-soft/40'
      : readyVariant === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10'
        : 'border-danger/20 bg-danger/10';

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`} data-testid="property-media-quality">
      <p className="mb-2 text-sm font-medium text-navy">{t('mediaQualityTitle')}</p>
      <p className="mb-2 text-xs text-muted">
        {t('mediaQualityRequiredHint', { min: MIN_MEDIA_FOR_PUBLISH })}
      </p>
      <ul className="space-y-1.5 text-sm text-muted">
        <li className="flex items-center gap-2">
          {assessment.count >= MIN_MEDIA_FOR_PUBLISH ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          ) : assessment.count > 0 ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-danger" />
          )}
          <span>
            {t('mediaQualityCount', { count: assessment.count, min: MIN_MEDIA_FOR_PUBLISH })}
            {remaining > 0 ? ` — ${t('mediaQualityNeedMore', { remaining })}` : null}
          </span>
        </li>
        <li className="flex items-center gap-2">
          {assessment.hasCover ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-danger" />
          )}
          {assessment.hasCover ? t('mediaQualityCoverYes') : t('mediaQualityCoverNo')}
        </li>
        {namespace === 'admin' && (
          <li className="flex items-center gap-2">
            {assessment.canPublish ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-danger" />
            )}
            {assessment.canPublish
              ? t('mediaQualityPublishReady')
              : t('mediaQualityPublishNotReady')}
          </li>
        )}
      </ul>
      {namespace === 'ownerProperty' && (
        <p className="mt-2 text-xs text-muted">{t('mediaQualityGalleryNote')}</p>
      )}
      {namespace === 'ownerProperty' && assessment.belowPublishMinimum && (
        <p className="mt-2 text-xs text-amber-800">{t('mediaQualityPublishWarning')}</p>
      )}
      {namespace === 'ownerProperty' && !assessment.canSubmitReview && (
        <p className="mt-2 text-xs text-danger">{t('mediaSubmitRequired')}</p>
      )}
    </div>
  );
}
