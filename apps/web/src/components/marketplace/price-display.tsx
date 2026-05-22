import type { Locale } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';

interface PriceDisplayProps {
  amount: number;
  currency: string;
  locale: Locale;
  fromLabel: string;
  perDayLabel: string;
}

export function PriceDisplay({ amount, currency, locale, fromLabel, perDayLabel }: PriceDisplayProps) {
  return (
    <p className="text-foreground">
      <span className="text-sm text-muted">{fromLabel} </span>
      <span className="text-lg font-semibold">{formatPrice(amount, currency, locale)}</span>
      <span className="text-sm text-muted"> / {perDayLabel}</span>
    </p>
  );
}
