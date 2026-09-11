'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useFavorites } from './favorites-context';

type Props = {
  propertyId: string;
  variant?: 'overlay' | 'inline' | 'text' | 'outline' | 'favorites';
};

export function FavoriteButton({ propertyId, variant = 'overlay' }: Props) {
  const t = useTranslations('favorites');
  const tProperty = useTranslations('property');
  const pathname = usePathname();
  const { ready, isCustomer, role, isFavorited, toggle } = useFavorites();
  const [busy, setBusy] = useState(false);

  if (role === 'owner' || role === 'admin') return null;

  const favorited = isFavorited(propertyId);
  const isText = variant === 'text';
  const isOutline = variant === 'outline';
  const isFavorites = variant === 'favorites';
  const showLabel = isText || isOutline;
  const className = cn(
    'inline-flex items-center justify-center transition-colors',
    isText && 'w-full gap-2 py-1 text-sm font-medium text-[#2F6EF6] hover:underline',
    isOutline &&
      'h-12 w-full gap-2 rounded-[14px] border border-[#2F6EF6]/55 bg-white text-[14px] font-semibold text-[#2F6EF6] hover:bg-[#F3F7FF]',
    isFavorites &&
      'h-9 w-9 rounded-full border border-white bg-white text-[#E11D48] shadow-[0_4px_12px_rgba(15,35,70,.14)] hover:bg-white',
    !isText &&
      !isOutline &&
      !isFavorites &&
      'h-9 w-9 border',
    !isText &&
      !isOutline &&
      !isFavorites &&
      (variant === 'overlay'
        ? 'rounded-[10px] border-white/90 bg-white text-[#0D2046] shadow-[0_4px_12px_rgba(15,35,70,.12)] hover:bg-white'
        : 'rounded-full border-border bg-surface text-navy hover:border-primary/40'),
    !isText && !isOutline && !isFavorites && favorited && 'border-primary/30 text-primary',
    showLabel && favorited && 'text-[#2F6EF6]',
    isOutline && favorited && 'border-[#2F6EF6] bg-[#EEF4FF]',
  );

  const textLabel = favorited ? t('remove') : tProperty('saveFavorite');
  const heartClass = cn(
    'h-4 w-4',
    favorited && isFavorites && 'fill-[#E11D48] text-[#E11D48]',
    favorited && !isFavorites && 'fill-[#2F6EF6] text-[#2F6EF6]',
    !favorited && isFavorites && 'text-[#2F6EF6]',
  );

  if (!ready) {
    return (
      <span className={cn(className, 'opacity-60')} aria-hidden>
        <Heart className={heartClass} />
        {showLabel ? <span>{tProperty('saveFavorite')}</span> : null}
      </span>
    );
  }

  if (!isCustomer) {
    const returnUrl = encodeURIComponent(pathname || '/');
    return (
      <Link
        href={`/auth?returnUrl=${returnUrl}`}
        data-testid="favorite-toggle"
        aria-label={t('add')}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        <Heart className={heartClass} />
        {showLabel ? <span>{tProperty('saveFavorite')}</span> : null}
      </Link>
    );
  }

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(propertyId);
    } catch {
      /* rollback in context */
    } finally {
      setBusy(false);
    }
  }

  const label = favorited ? t('remove') : t('add');

  return (
    <button
      type="button"
      data-testid="favorite-toggle"
      aria-label={label}
      aria-pressed={favorited}
      disabled={busy}
      className={className}
      onClick={(e) => void onClick(e)}
    >
      <Heart className={heartClass} />
      {showLabel ? <span>{textLabel}</span> : null}
    </button>
  );
}
