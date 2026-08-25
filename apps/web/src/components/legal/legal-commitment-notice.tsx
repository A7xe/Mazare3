'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function LegalCommitmentNotice({ testId }: { testId: string }) {
  const t = useTranslations('legal');
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted" data-testid={testId}>
      {t('commitmentLead')}{' '}
      <Link href="/terms" className="font-medium text-primary hover:underline">
        {t('nav.terms')}
      </Link>
      {t('commitmentComma')}
      <Link href="/cancellation-refund" className="font-medium text-primary hover:underline">
        {t('nav.cancellation-refund')}
      </Link>
      {t('commitmentAnd')}
      <Link href="/privacy" className="font-medium text-primary hover:underline">
        {t('nav.privacy')}
      </Link>
      {t('commitmentEnd')}
    </p>
  );
}
