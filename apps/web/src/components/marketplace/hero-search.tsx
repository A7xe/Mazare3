'use client';

import { useTranslations } from 'next-intl';
import { Search, MapPin, Calendar, Users } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function HeroSearch() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push('/search');
  }

  return (
    <form
      onSubmit={handleSearch}
      className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-surface p-3 shadow-soft sm:rounded-3xl sm:p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <MapPin className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="ps-10"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="ps-10" type="date" aria-label={t('dateLabel')} />
        </div>
        <div className="relative">
          <Users className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="ps-10"
            type="number"
            min={1}
            max={50}
            defaultValue={10}
            aria-label={t('guestsLabel')}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <Search className="h-4 w-4" />
          {tCommon('search')}
        </Button>
      </div>
    </form>
  );
}
