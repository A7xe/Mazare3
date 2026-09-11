'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

interface MobileBookCtaProps {
  propertySlug: string;
  basePrice: number;
  currency: string;
  exact?: boolean;
  bookHref?: string;
}

export function MobileBookCta({
  propertySlug,
  basePrice,
  currency,
  exact = false,
  bookHref,
}: MobileBookCtaProps) {
  const tCommon = useTranslations('common');
  const href = bookHref ?? `/properties/${propertySlug}/book`;

  return (
    <div
      data-testid="mobile-book-cta"
      className="fixed inset-x-0 bottom-[7.5rem] z-30 border-t border-primary/10 bg-surface/95 px-4 pt-3 pb-3 shadow-premium backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
        <div>
          {!exact && <p className="text-xs text-muted">{tCommon('from')}</p>}
          <p className="text-lg font-bold text-navy">
            {basePrice} {currency}
          </p>
        </div>
        <Button asChild className="min-h-12 flex-1 shadow-soft" size="lg">
          <Link href={href} data-testid="mobile-book-now">
            {tCommon('bookNow')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
