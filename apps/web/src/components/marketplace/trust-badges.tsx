'use client';

import { ShieldCheck, Star, BadgePercent, Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';

const icons = [Camera, ShieldCheck, Star, BadgePercent] as const;

export function TrustBadges() {
  const t = useTranslations('home');
  const items = [
    t('trustVerified'),
    t('trustBooking'),
    t('trustReviews'),
    t('trustDeals'),
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {items.map((label, i) => {
        const Icon = icons[i] ?? ShieldCheck;
        return (
          <div
            key={label}
            className="flex items-center gap-2 rounded-2xl border border-border bg-surface/80 px-4 py-2.5 text-sm shadow-card backdrop-blur-sm"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
