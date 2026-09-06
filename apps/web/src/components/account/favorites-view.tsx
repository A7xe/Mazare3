'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Heart, Loader2 } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PropertyCard } from '@/components/marketplace/property-card';
import { AccountSubnav } from '@/components/account/account-subnav';
import { fetchBookableFavorites } from '@/lib/api-favorites';
import { getMe } from '@/lib/api-auth';
import { useFavorites } from '@/components/favorites/favorites-context';

export function FavoritesView() {
  const t = useTranslations('favorites');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { ids, ready } = useFavorites();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PublicPropertySummary[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      if (me.data.user.role !== 'customer') {
        router.push('/');
        return;
      }
      const res = await fetchBookableFavorites();
      setItems(res.data);
    } catch {
      router.push('/auth?returnUrl=' + encodeURIComponent('/account/favorites'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load, ids, ready]);

  return (
    <div className="space-y-6">
      <AccountSubnav />
      <div>
        <h1 className="text-3xl font-heading text-navy">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" data-testid="favorites-loading">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-3xl border border-primary/12 bg-surface px-6 py-16 text-center"
          data-testid="favorites-empty"
        >
          <Heart className="mx-auto h-12 w-12 text-primary/40" />
          <p className="mt-4 text-lg font-medium text-navy">{t('empty')}</p>
          <Button asChild className="mt-6 shadow-soft">
            <Link href="/search">{tCommon('explore')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
