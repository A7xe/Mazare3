'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface MobileBookCtaProps {
  basePrice: number;
  currency: string;
  exact?: boolean;
}

export function MobileBookCta({ basePrice, currency, exact = false }: MobileBookCtaProps) {
  const tCommon = useTranslations('common');

  return (
    <div className="fixed inset-x-0 bottom-[7.5rem] z-30 border-t border-primary/10 bg-surface/95 px-4 pt-3 pb-3 shadow-premium backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
        <div>
          {!exact && <p className="text-xs text-muted">{tCommon('from')}</p>}
          <p className="text-lg font-bold text-navy">
            {basePrice} {currency}
          </p>
        </div>
        <Button asChild className="min-h-12 flex-1 shadow-soft" size="lg">
          <a href="#booking-panel">{tCommon('bookNow')}</a>
        </Button>
      </div>
    </div>
  );
}
