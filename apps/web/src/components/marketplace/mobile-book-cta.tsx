'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface MobileBookCtaProps {
  basePrice: number;
  currency: string;
}

export function MobileBookCta({ basePrice, currency }: MobileBookCtaProps) {
  const tCommon = useTranslations('common');

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-surface/95 p-4 shadow-premium backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted">{tCommon('from')}</p>
          <p className="text-lg font-bold text-navy">
            {basePrice} {currency}
          </p>
        </div>
        <Button asChild className="flex-1 shadow-soft" size="lg">
          <a href="#booking-panel">{tCommon('bookNow')}</a>
        </Button>
      </div>
    </div>
  );
}
