'use client';

import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';
import type { PublicPropertyDetail } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriceDisplay } from './price-display';

interface BookingPanelProps {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
}

export function BookingPanel({ property, locale }: BookingPanelProps) {
  const t = useTranslations('property');
  const tCommon = useTranslations('common');

  return (
    <Card className="sticky top-24 border-border shadow-soft">
      <CardHeader>
        <CardTitle>{t('bookingPanelTitle')}</CardTitle>
        <PriceDisplay
          amount={property.basePrice}
          currency={property.currency}
          locale={locale}
          fromLabel={tCommon('from')}
          perDayLabel={tCommon('perDay')}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" />
            {t('selectDate')}
          </label>
          <Input type="date" disabled />
        </div>
        <Input type="number" min={1} max={property.capacity} defaultValue={10} disabled />
        <Button className="w-full" disabled>
          {tCommon('bookNow')} — {tCommon('comingSoon')}
        </Button>
        <p className="text-center text-xs text-muted">{t('bookingPanelNote')}</p>
      </CardContent>
    </Card>
  );
}
