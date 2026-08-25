import type { Locale } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';

interface PriceDisplayProps {
  amount: number;
  currency: string;
  locale: Locale;
  fromLabel?: string;
  perDayLabel?: string;
  large?: boolean;
  exact?: boolean;
  browseHint?: string;
  originalAmount?: number;
}

export function PriceDisplay({
  amount,
  currency,
  locale,
  fromLabel,
  perDayLabel,
  large = false,
  exact = false,
  browseHint,
  originalAmount,
}: PriceDisplayProps) {
  const showDeal = originalAmount != null && originalAmount > amount;
  return (
    <span className="inline-flex flex-col text-foreground" data-testid={exact ? 'exact-slot-price' : 'browse-from-price'}>
      <span>
        {fromLabel && !exact ? <span className="text-sm text-muted">{fromLabel} </span> : null}
        {showDeal ? (
          <span className="me-2 text-sm text-muted line-through" data-testid="price-original">
            {formatPrice(originalAmount, currency, locale)}
          </span>
        ) : null}
        <span
          className={large ? 'text-2xl font-bold text-navy' : 'text-lg font-bold text-navy'}
          data-testid="price-final"
        >
          {formatPrice(amount, currency, locale)}
        </span>
        {perDayLabel && !exact ? <span className="text-sm text-muted"> / {perDayLabel}</span> : null}
      </span>
      {browseHint && !exact ? <span className="text-xs text-muted">{browseHint}</span> : null}
    </span>
  );
}
