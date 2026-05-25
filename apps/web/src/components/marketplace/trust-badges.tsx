'use client';

import { ShieldCheck, Star, BadgePercent, Camera, Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

const icons = [Camera, ShieldCheck, Star, BadgePercent] as const;

interface TrustBadgesProps {
  showSupport?: boolean;
  compact?: boolean;
}

export function TrustBadges({ showSupport = false, compact = false }: TrustBadgesProps) {
  const t = useTranslations('home');
  const items = [
    t('trustVerified'),
    t('trustBooking'),
    t('trustReviews'),
    t('trustDeals'),
  ];
  if (showSupport) {
    items.push(t('trustSupport'));
  }

  const allIcons = showSupport ? [...icons, Headphones] : icons;

  return (
    <div className={`flex flex-wrap justify-center gap-2 sm:gap-3 ${compact ? 'gap-2' : ''}`}>
      {items.map((label, i) => {
        const Icon = allIcons[i] ?? ShieldCheck;
        const isHighlight = i === 1 || i === 3;
        return (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm backdrop-blur-md ${
              isHighlight
                ? 'border-royal/20 bg-royal/8 text-royal'
                : 'glass-surface text-navy'
            } ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5'}`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${isHighlight ? 'text-royal' : 'text-primary'}`}
              aria-hidden
            />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
