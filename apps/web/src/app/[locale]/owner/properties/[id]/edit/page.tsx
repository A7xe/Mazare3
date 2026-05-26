'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { OwnerPropertyEdit } from '@mazare3/shared';
import { OwnerPropertyForm } from '@/components/owner/owner-property-form';
import { fetchOwnerPropertyEdit } from '@/lib/api-owner';

type Props = { params: Promise<{ id: string }> };

export default function OwnerEditPropertyPage({ params }: Props) {
  const t = useTranslations('ownerProperty');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [initial, setInitial] = useState<OwnerPropertyEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => {
      setPropertyId(id);
      void (async () => {
        try {
          const res = await fetchOwnerPropertyEdit(id);
          setInitial(res.data);
        } catch (e) {
          setError(e instanceof Error ? e.message : t('loadError'));
        } finally {
          setLoading(false);
        }
      })();
    });
  }, [params, t]);

  if (loading || !propertyId) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !initial) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
        {error ?? t('notFound')}
      </p>
    );
  }

  return <OwnerPropertyForm mode="edit" initial={initial} />;
}
