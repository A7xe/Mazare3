import type { Locale } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';

interface PriceDisplayProps {
  amount: number;
  currency: string;
  locale: Locale;
  fromLabel?: string;
  perDayLabel?: string;
  large?: boolean;
}

export function PriceDisplay({
  amount,
  currency,
  locale,
  fromLabel,
  perDayLabel,
  large = false,
}: PriceDisplayProps) {
  return (
    <p className="text-foreground">
      {fromLabel ? <span className="text-sm text-muted">{fromLabel} </span> : null}
      <span className={large ? 'text-2xl font-bold text-navy' : 'text-lg font-bold text-navy'}>
        {formatPrice(amount, currency, locale)}
      </span>
      {perDayLabel ? <span className="text-sm text-muted"> / {perDayLabel}</span> : null}
    </p>
  );
}
