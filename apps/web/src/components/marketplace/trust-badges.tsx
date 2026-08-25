'use client';

import { ShieldCheck, Camera, BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TrustBadgesProps {
  showSupport?: boolean;
  compact?: boolean;
}

export function TrustBadges({ compact = false }: TrustBadgesProps) {
  const t = useTranslations('home');
  const items = [
    { label: t('trustPhotos'), icon: Camera },
    { label: t('trustBooking'), icon: ShieldCheck },
    { label: t('trustVerifiedListings'), icon: BadgeCheck },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'justify-start' : 'justify-center'}`}>
      {items.map(({ label, icon: Icon }) => (
        <div
          key={label}
          className={`flex items-center gap-2 rounded-2xl border border-border bg-surface text-navy ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
