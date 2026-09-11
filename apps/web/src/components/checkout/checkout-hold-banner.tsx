'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Timer } from 'lucide-react';
import { formatRemainingDuration } from '@/lib/format-platform-time';

export function CheckoutHoldBanner({
  holdExpiresAt,
  locale,
}: {
  holdExpiresAt: string;
  locale: 'ar' | 'en';
}) {
  const t = useTranslations('checkout');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = formatRemainingDuration(holdExpiresAt, locale, new Date(now));
  const expired = new Date(holdExpiresAt).getTime() <= now;

  if (expired) return null;

  return (
    <div
      data-testid="checkout-hold-banner"
      className="flex items-start gap-2 rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]"
    >
      <Timer className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        {t('holdReservedFor')}{' '}
        <span className="font-bold tabular-nums" data-testid="checkout-hold-remaining">
          {remaining}
        </span>
      </p>
    </div>
  );
}
